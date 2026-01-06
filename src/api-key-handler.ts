/**
 * API Key Authentication Handler for 3D Abstract Moodboard MCP Server
 *
 * Provides API key authentication for MCP clients that don't support OAuth.
 * Uses an LRU cache to prevent memory leaks from unbounded server creation.
 */

import * as z from "zod/v4";
import { validateApiKey } from "./auth/apiKeys";
import type { Env, GenerateMoodSceneInput, LearnMoodPrimitivesInput } from "./types";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
  RESOURCE_URI_META_KEY,
} from "@modelcontextprotocol/ext-apps/server";
import { TOOL_METADATA, getToolDescription } from "./tools/descriptions";
import { logger } from "./shared/logger";
import { UI_RESOURCES, UI_MIME_TYPE } from "./resources/ui-resources";
import { loadHtml } from "./helpers/assets";
import { SERVER_INSTRUCTIONS } from "./server-instructions";
import {
  enhanceEmotionToThreeJS,
  MOOD_PRIMITIVES_DOCUMENTATION,
  type MoodPrimitivesCategory,
} from "./ai-prompt-enhancer";

// ============================================================================
// Configuration
// ============================================================================

const MAX_CACHED_SERVERS = 100;
const SERVER_NAME = "3D Abstract Moodboard";
const SERVER_VERSION = "1.0.0";

// ============================================================================
// LRU Cache for McpServer instances
// ============================================================================

class LRUCache<K, V> {
  private cache: Map<K, { value: V; lastAccessed: number }>;
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
      return entry.value;
    }
    return undefined;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    this.cache.set(key, { value, lastAccessed: Date.now() });
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  get size(): number {
    return this.cache.size;
  }

  private evictLRU(): void {
    let oldestKey: K | undefined;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    if (oldestKey !== undefined) {
      logger.info({
        event: 'lru_cache_eviction',
        evicted_user_id: String(oldestKey),
        cache_size: this.cache.size,
      });
      this.cache.delete(oldestKey);
    }
  }
}

const serverCache = new LRUCache<string, McpServer>(MAX_CACHED_SERVERS);

// ============================================================================
// Main Entry Point
// ============================================================================

export async function handleApiKeyRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  pathname: string
): Promise<Response> {
  try {
    const authHeader = request.headers.get("Authorization");
    const apiKey = authHeader?.replace("Bearer ", "");

    if (!apiKey) {
      return jsonError("Missing Authorization header", 401);
    }

    const validationResult = await validateApiKey(apiKey, env);
    if (!validationResult) {
      logger.warn({
        event: 'auth_attempt',
        method: 'api_key',
        success: false,
        reason: 'Invalid or expired API key',
      });
      return jsonError("Invalid or expired API key", 401);
    }

    const { userId, email } = validationResult;
    logger.info({
      event: 'auth_attempt',
      method: 'api_key',
      user_email: email,
      user_id: userId,
      success: true,
    });

    const server = await getOrCreateServer(env, userId, email);

    if (pathname === "/mcp") {
      return await handleHTTPTransport(server, request, env, userId, email);
    } else {
      return jsonError("Invalid endpoint. Use /mcp", 400);
    }
  } catch (error) {
    logger.error({
      event: 'server_error',
      error: error instanceof Error ? error.message : String(error),
      context: 'API key handler',
    });
    return jsonError(`Internal server error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
}

// ============================================================================
// Server Instance Management
// ============================================================================

async function getOrCreateServer(
  env: Env,
  userId: string,
  email: string
): Promise<McpServer> {
  const cached = serverCache.get(userId);
  if (cached) return cached;

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  }, {
    capabilities: {
      tools: {},
      prompts: { listChanged: true },
      resources: { listChanged: true }
    },
    instructions: SERVER_INSTRUCTIONS
  });

  // ========================================================================
  // SEP-1865 MCP Apps: UI Resource Registration
  // ========================================================================
  const moodboardResource = UI_RESOURCES.moodboard;

  registerAppResource(
    server,
    moodboardResource.uri,
    moodboardResource.uri,
    {
      mimeType: RESOURCE_MIME_TYPE,
      description: moodboardResource.description,
      _meta: { ui: moodboardResource._meta.ui! }
    },
    async () => {
      const templateHTML = await loadHtml(env.ASSETS, "/moodboard.html");
      return {
        contents: [{
          uri: moodboardResource.uri,
          mimeType: RESOURCE_MIME_TYPE,
          text: templateHTML,
          _meta: moodboardResource._meta as Record<string, unknown>
        }]
      };
    }
  );

  // ========================================================================
  // Tool 1: generate_mood_scene
  // ========================================================================
  registerAppTool(
    server,
    "generate_mood_scene",
    {
      title: TOOL_METADATA["generate_mood_scene"].title,
      description: getToolDescription("generate_mood_scene"),
      inputSchema: {
        emotion: z.string().min(1).meta({
          description: "The feeling or concept to visualize (e.g., peace, chaos, energy, curiosity)"
        }),
        complexity: z.number().int().min(1).max(10).optional().meta({
          description: "Scale from 1-10 of how many objects to generate (default: 5)"
        }),
        height: z.number().int().positive().optional().meta({
          description: "Height in pixels for the 3D canvas (default: 600)"
        }),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      },
      _meta: {
        [RESOURCE_URI_META_KEY]: moodboardResource.uri
      }
    },
    async (args: GenerateMoodSceneInput) => {
      const { emotion, complexity = 5, height = 600 } = args;
      const startTime = Date.now();

      try {
        const code = await enhanceEmotionToThreeJS(
          env.AI,
          emotion,
          complexity,
          env.AI_GATEWAY_ID
        );

        const durationMs = Date.now() - startTime;

        logger.info({
          event: "tool_completed",
          tool: "generate_mood_scene",
          user_id: userId,
          user_email: email,
          action_id: "",
          duration_ms: durationMs,
        });

        const result = { code, emotion, height };

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(result, null, 2)
          }],
          structuredContent: result as unknown as Record<string, unknown>
        };
      } catch (error) {
        logger.error({
          event: "tool_failed",
          tool: "generate_mood_scene",
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          content: [{
            type: "text" as const,
            text: `Error generating mood scene: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // ========================================================================
  // Tool 2: learn_mood_primitives (Documentation Only)
  // ========================================================================
  server.registerTool(
    "learn_mood_primitives",
    {
      title: TOOL_METADATA["learn_mood_primitives"].title,
      description: getToolDescription("learn_mood_primitives"),
      inputSchema: {
        category: z.enum(["geometries", "materials", "lighting", "animation", "all"]).optional().meta({
          description: "Category of documentation to retrieve (default: all)"
        }),
      },
    },
    async (args: LearnMoodPrimitivesInput) => {
      const category: MoodPrimitivesCategory = args.category ?? "all";
      const documentation = MOOD_PRIMITIVES_DOCUMENTATION[category];

      logger.info({
        event: "tool_completed",
        tool: "learn_mood_primitives",
        user_id: userId,
        user_email: email,
        action_id: "",
        duration_ms: 0,
      });

      return {
        content: [{
          type: "text" as const,
          text: documentation,
        }],
      };
    }
  );

  serverCache.set(userId, server);
  return server;
}

// ============================================================================
// HTTP Transport Handler (JSON-RPC over HTTP)
// ============================================================================

async function handleHTTPTransport(
  server: McpServer,
  request: Request,
  env: Env,
  userId: string,
  userEmail: string
): Promise<Response> {
  try {
    const jsonRpcRequest = await request.json() as {
      jsonrpc: string;
      id: number | string;
      method: string;
      params?: unknown;
    };

    if (jsonRpcRequest.jsonrpc !== "2.0") {
      return jsonRpcResponse(jsonRpcRequest.id, null, { code: -32600, message: "Invalid Request" });
    }

    switch (jsonRpcRequest.method) {
      case "initialize":
        return handleInitialize(jsonRpcRequest);
      case "ping":
        return handlePing(jsonRpcRequest);
      case "tools/list":
        return await handleToolsList(jsonRpcRequest);
      case "tools/call":
        return await handleToolsCall(jsonRpcRequest, env, userId, userEmail);
      case "resources/list":
        return await handleResourcesList(jsonRpcRequest);
      case "resources/read":
        return await handleResourcesRead(jsonRpcRequest, env);
      case "prompts/list":
        return await handlePromptsList(jsonRpcRequest);
      default:
        return jsonRpcResponse(jsonRpcRequest.id, null, { code: -32601, message: `Method not found: ${jsonRpcRequest.method}` });
    }
  } catch (error) {
    return jsonRpcResponse("error", null, { code: -32700, message: `Parse error: ${error instanceof Error ? error.message : String(error)}` });
  }
}

// ============================================================================
// JSON-RPC Method Handlers
// ============================================================================

function handleInitialize(request: { id: number | string }): Response {
  return jsonRpcResponse(request.id, {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {},
      prompts: { listChanged: true },
      resources: { listChanged: true }
    },
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
  });
}

function handlePing(request: { id: number | string }): Response {
  return jsonRpcResponse(request.id, {});
}

async function handleToolsList(request: { id: number | string }): Promise<Response> {
  return jsonRpcResponse(request.id, {
    tools: [
      {
        name: "generate_mood_scene",
        title: TOOL_METADATA["generate_mood_scene"].title,
        description: getToolDescription("generate_mood_scene"),
        inputSchema: {
          type: "object",
          properties: {
            emotion: { type: "string", description: "The feeling or concept to visualize" },
            complexity: { type: "number", description: "Scale from 1-10 (default: 5)" },
            height: { type: "number", description: "Height in pixels (default: 600)" }
          },
          required: ["emotion"]
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false
        }
      },
      {
        name: "learn_mood_primitives",
        title: TOOL_METADATA["learn_mood_primitives"].title,
        description: getToolDescription("learn_mood_primitives"),
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["geometries", "materials", "lighting", "animation", "all"],
              description: "Category of documentation (default: all)"
            }
          },
          required: []
        }
      }
    ]
  });
}

async function handleToolsCall(
  request: { id: number | string; params?: unknown },
  env: Env,
  userId: string,
  userEmail: string
): Promise<Response> {
  const params = request.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
  const { name, arguments: args } = params || {};

  switch (name) {
    case "generate_mood_scene": {
      const emotion = (args?.emotion as string) || "";
      const complexity = (args?.complexity as number) || 5;
      const height = (args?.height as number) || 600;
      const startTime = Date.now();

      try {
        const code = await enhanceEmotionToThreeJS(
          env.AI,
          emotion,
          complexity,
          env.AI_GATEWAY_ID
        );

        const durationMs = Date.now() - startTime;

        logger.info({
          event: "tool_completed",
          tool: "generate_mood_scene",
          user_id: userId,
          user_email: userEmail,
          action_id: "",
          duration_ms: durationMs,
        });

        const result = { code, emotion, height };

        return jsonRpcResponse(request.id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result
        });
      } catch (error) {
        logger.error({
          event: "tool_failed",
          tool: "generate_mood_scene",
          error: error instanceof Error ? error.message : String(error),
        });

        return jsonRpcResponse(request.id, {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        });
      }
    }

    case "learn_mood_primitives": {
      const category: MoodPrimitivesCategory = (args?.category as MoodPrimitivesCategory) || "all";
      const documentation = MOOD_PRIMITIVES_DOCUMENTATION[category];

      logger.info({
        event: "tool_completed",
        tool: "learn_mood_primitives",
        user_id: userId,
        user_email: userEmail,
        action_id: "",
        duration_ms: 0,
      });

      return jsonRpcResponse(request.id, {
        content: [{ type: "text", text: documentation }]
      });
    }

    default:
      return jsonRpcResponse(request.id, null, { code: -32602, message: `Unknown tool: ${name}` });
  }
}

async function handleResourcesList(request: { id: number | string }): Promise<Response> {
  return jsonRpcResponse(request.id, {
    resources: [{
      uri: UI_RESOURCES.moodboard.uri,
      name: UI_RESOURCES.moodboard.name,
      description: UI_RESOURCES.moodboard.description,
      mimeType: UI_RESOURCES.moodboard.mimeType
    }]
  });
}

async function handleResourcesRead(
  request: { id: number | string; params?: unknown },
  env: Env
): Promise<Response> {
  const params = request.params as { uri?: string } | undefined;
  const { uri } = params || {};

  if (uri === UI_RESOURCES.moodboard.uri) {
    const html = await loadHtml(env.ASSETS, "/moodboard.html");
    return jsonRpcResponse(request.id, {
      contents: [{
        uri: UI_RESOURCES.moodboard.uri,
        mimeType: UI_MIME_TYPE,
        text: html,
        _meta: UI_RESOURCES.moodboard._meta
      }]
    });
  }

  return jsonRpcResponse(request.id, null, { code: -32602, message: `Unknown resource: ${uri}` });
}

async function handlePromptsList(request: { id: number | string }): Promise<Response> {
  return jsonRpcResponse(request.id, {
    prompts: [{
      name: "visualize-feeling",
      title: "Visualize a Feeling",
      description: "Converts your current mood or a specific abstract concept into a unique 3D art installation.",
      argsSchema: {
        type: "object",
        properties: {
          emotion: { type: "string", description: "The feeling you want to see" },
          complexity: { type: "string", description: "Scale from 1-10 (optional)" }
        },
        required: ["emotion"]
      }
    }]
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function jsonRpcResponse(id: number | string, result: unknown, error?: { code: number; message: string }): Response {
  const response: Record<string, unknown> = { jsonrpc: "2.0", id };
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  return new Response(JSON.stringify(response), {
    headers: { "Content-Type": "application/json" }
  });
}
