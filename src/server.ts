/**
 * 3D Abstract Moodboard MCP Server
 *
 * McpAgent extension with OAuth authentication and SEP-1865 MCP Apps support.
 * Generates interactive Three.js art installations from emotional prompts.
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RESOURCE_URI_META_KEY } from "@modelcontextprotocol/ext-apps";
import * as z from "zod/v4";
import type { Env, GenerateMoodSceneInput, LearnMoodPrimitivesInput } from "./types";
import type { Props } from "./auth/props";
import { loadHtml } from "./helpers/assets";
import { UI_RESOURCES, UI_MIME_TYPE } from "./resources/ui-resources";
import { SERVER_INSTRUCTIONS } from "./server-instructions";
import { TOOL_METADATA, getToolDescription } from "./tools/descriptions";
import { logger } from "./shared/logger";
import {
  enhanceEmotionToThreeJS,
  MOOD_PRIMITIVES_DOCUMENTATION,
  type MoodPrimitivesCategory,
} from "./ai-prompt-enhancer";

/**
 * 3D Abstract Moodboard MCP Server
 *
 * Extends McpAgent for Cloudflare Workers with:
 * - Workers AI for code generation
 * - Three.js widget for 3D rendering
 * - Dual authentication (OAuth + API Key)
 */
export class Moodboard3DMCP extends McpAgent<Env, unknown, Props> {
  server = new McpServer(
    {
      name: "3D Abstract Moodboard",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        prompts: { listChanged: true },
        resources: { listChanged: true },
      },
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  async init() {
    const moodboardResource = UI_RESOURCES.moodboard;

    // ========================================================================
    // PART 1: Register UI Resource (Three.js Widget)
    // ========================================================================
    this.server.registerResource(
      moodboardResource.name,
      moodboardResource.uri,
      {
        description: moodboardResource.description,
        mimeType: moodboardResource.mimeType,
      },
      async () => {
        const templateHTML = await loadHtml(this.env.ASSETS, "/moodboard.html");

        return {
          contents: [
            {
              uri: moodboardResource.uri,
              mimeType: UI_MIME_TYPE,
              text: templateHTML,
              _meta: moodboardResource._meta as Record<string, unknown>,
            },
          ],
        };
      }
    );

    logger.info({
      event: "ui_resource_registered",
      uri: moodboardResource.uri,
      name: moodboardResource.name,
    });

    // ========================================================================
    // PART 2: Register generate_mood_scene Tool
    // ========================================================================
    this.server.registerTool(
      "generate_mood_scene",
      {
        title: TOOL_METADATA["generate_mood_scene"].title,
        description: getToolDescription("generate_mood_scene"),
        inputSchema: {
          emotion: z
            .string()
            .min(1)
            .meta({
              description:
                "The feeling or concept to visualize (e.g., peace, chaos, energy, curiosity)",
            }),
          complexity: z
            .number()
            .int()
            .min(1)
            .max(10)
            .optional()
            .meta({
              description:
                "Scale from 1-10 of how many objects to generate (default: 5)",
            }),
          height: z
            .number()
            .int()
            .positive()
            .optional()
            .meta({
              description: "Height in pixels for the 3D canvas (default: 600)",
            }),
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false, // AI-generated code may vary
          openWorldHint: false,
        },
        _meta: {
          [RESOURCE_URI_META_KEY]: moodboardResource.uri,
        },
      },
      async (args) => {
        if (!this.props?.userId) {
          throw new Error("User ID not found in authentication context");
        }

        const { emotion, complexity = 5, height = 600 } = args as GenerateMoodSceneInput;
        const startTime = Date.now();

        try {
          // Generate Three.js code using Workers AI
          const code = await enhanceEmotionToThreeJS(
            this.env.AI,
            emotion,
            complexity,
            this.env.AI_GATEWAY_ID
          );

          const durationMs = Date.now() - startTime;

          logger.info({
            event: "tool_completed",
            tool: "generate_mood_scene",
            user_id: this.props.userId ?? "",
            user_email: this.props.email ?? "",
            action_id: "",
            duration_ms: durationMs,
          });

          const result = {
            code,
            emotion,
            height,
          };

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
            structuredContent: result as unknown as Record<string, unknown>,
          };
        } catch (error) {
          logger.error({
            event: "tool_failed",
            tool: "generate_mood_scene",
            error: error instanceof Error ? error.message : String(error),
          });

          return {
            content: [
              {
                type: "text" as const,
                text: `Error generating mood scene: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    // ========================================================================
    // PART 3: Register learn_mood_primitives Tool (Documentation Only)
    // ========================================================================
    this.server.registerTool(
      "learn_mood_primitives",
      {
        title: TOOL_METADATA["learn_mood_primitives"].title,
        description: getToolDescription("learn_mood_primitives"),
        inputSchema: {
          category: z
            .enum(["geometries", "materials", "lighting", "animation", "all"])
            .optional()
            .meta({
              description:
                "Category of documentation to retrieve (default: all)",
            }),
        },
      },
      async (args) => {
        const typedArgs = args as LearnMoodPrimitivesInput;
        const category: MoodPrimitivesCategory = typedArgs.category ?? "all";
        const documentation = MOOD_PRIMITIVES_DOCUMENTATION[category];

        logger.info({
          event: "tool_completed",
          tool: "learn_mood_primitives",
          user_id: this.props?.userId ?? "",
          user_email: this.props?.email ?? "",
          action_id: "",
          duration_ms: 0,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: documentation,
            },
          ],
        };
      }
    );

    // ========================================================================
    // Register Prompt: visualize-feeling
    // ========================================================================
    this.server.registerPrompt(
      "visualize-feeling",
      {
        title: "Visualize a Feeling",
        description:
          "Converts your current mood or a specific abstract concept into a unique 3D art installation.",
        argsSchema: {
          emotion: z.string().meta({
            description:
              "The feeling you want to see (e.g., peace, curiosity, tension)",
          }),
          complexity: z
            .string()
            .optional()
            .meta({
              description: "Scale from 1-10 of how many objects to generate",
            }),
        },
      },
      async ({ emotion, complexity }) => {
        const complexityNum = complexity ? parseInt(complexity, 10) : 5;
        const validComplexity = Math.min(10, Math.max(1, complexityNum || 5));

        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Please use the 'generate_mood_scene' tool to create a 3D visualization of the feeling: "${emotion}" with complexity ${validComplexity}. After generating, explain what visual elements were used to represent this emotion.`,
              },
            },
          ],
        };
      }
    );

    logger.info({ event: "server_started", auth_mode: "dual" });
  }
}
