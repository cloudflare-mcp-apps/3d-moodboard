/**
 * Cloudflare Workers Environment Bindings
 *
 * This interface defines all the bindings available to the 3D Moodboard MCP server,
 * including authentication credentials, Workers AI, and Cloudflare resources.
 */
export interface Env {
  // ========================================================================
  // REQUIRED: OAuth and Authentication Bindings
  // ========================================================================

  /** KV namespace for storing OAuth tokens and session data */
  OAUTH_KV: KVNamespace;

  /** Durable Object namespace for MCP server instances (required by McpAgent) */
  MCP_OBJECT: DurableObjectNamespace;

  /** D1 Database for user and API key management (shared mcp-oauth database) */
  DB: D1Database;

  /** WorkOS Client ID (public, used to initiate OAuth flows) */
  WORKOS_CLIENT_ID: string;

  /** WorkOS API Key (sensitive, starts with sk_, used to initialize WorkOS SDK) */
  WORKOS_API_KEY: string;

  /**
   * KV namespace for centralized custom login session storage (MANDATORY)
   *
   * CRITICAL: This is REQUIRED for centralized authentication at panel.wtyczki.ai
   * Sessions are shared across all MCP servers for SSO functionality.
   */
  USER_SESSIONS: KVNamespace;

  // ========================================================================
  // REQUIRED: MCP Apps (SEP-1865) Bindings
  // ========================================================================

  /**
   * Cloudflare Assets Binding for MCP Apps
   *
   * Used to serve built HTML widgets from web/dist/widgets directory.
   * Required for SEP-1865 MCP Apps protocol support.
   */
  ASSETS: Fetcher;

  // ========================================================================
  // REQUIRED: Workers AI Binding
  // ========================================================================

  /**
   * Workers AI for generating Three.js code from emotional prompts
   *
   * Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast
   * Used by: AI prompt enhancer to convert emotions to Three.js code
   */
  AI: Ai;

  // ========================================================================
  // OPTIONAL: Common Cloudflare Bindings
  // ========================================================================

  /**
   * Cache KV for API response caching
   */
  CACHE_KV?: KVNamespace;

  /**
   * AI Gateway configuration for rate limiting and logging AI calls
   */
  AI_GATEWAY_ID?: string;
}

// ========================================================================
// Response Format Types
// ========================================================================

export enum ResponseFormat {
  CONCISE = "concise",
  DETAILED = "detailed"
}

// ========================================================================
// Tool Input/Output Types
// ========================================================================

/**
 * Input for generate_mood_scene tool
 */
export interface GenerateMoodSceneInput {
  emotion: string;
  complexity?: number;
  height?: number;
}

/**
 * Output for generate_mood_scene tool
 */
export interface GenerateMoodSceneOutput {
  code: string;
  emotion: string;
  height: number;
}

/**
 * Input for learn_mood_primitives tool
 */
export interface LearnMoodPrimitivesInput {
  category?: "geometries" | "materials" | "lighting" | "animation" | "all";
}