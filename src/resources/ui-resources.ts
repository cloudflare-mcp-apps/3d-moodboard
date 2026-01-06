/**
 * MCP App UI Resource Definitions (SEP-1865)
 *
 * Defines UI resources for the 3D Abstract Moodboard MCP server.
 * Resources are linked to tools via _meta["ui/resourceUri"] for
 * rich interactive widgets in MCP-capable chat clients.
 */

export const UI_MIME_TYPE = "text/html;profile=mcp-app" as const;

export interface UIResourceMeta {
  ui?: {
    csp?: {
      connectDomains?: string[];
      resourceDomains?: string[];
    };
    domain?: string;
    prefersBorder?: boolean;
  };
}

export interface UIResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: typeof UI_MIME_TYPE;
  _meta: UIResourceMeta;
}

/**
 * UI Resources Registry
 *
 * Defines the moodboard widget resource for Three.js scene rendering.
 */
export const UI_RESOURCES = {
  /**
   * Moodboard Widget
   *
   * Interactive Three.js canvas for rendering abstract 3D art installations.
   * Supports streaming code preview and OrbitControls for user exploration.
   *
   * Used by: generate_mood_scene tool
   * Data delivery: Via ui/notifications/tool-result postMessage
   */
  moodboard: {
    uri: "ui://3d-moodboard/moodboard.html",

    name: "moodboard_widget",

    description:
      "3D Abstract Moodboard - Interactive Three.js scene viewer with streaming code preview. " +
      "Renders abstract art installations from emotional prompts with OrbitControls for exploration.",

    mimeType: UI_MIME_TYPE,

    _meta: {
      ui: {
        csp: {
          // No external API calls from widget - all data via MCP protocol
          connectDomains: [] as string[],
          // All resources inlined by viteSingleFile - no CDN needed
          resourceDomains: [] as string[],
        },
        prefersBorder: false, // 3D canvas looks better without border
      },
    },
  },
} as const;

export type UiResourceUri = typeof UI_RESOURCES[keyof typeof UI_RESOURCES]["uri"];

export const UI_EXTENSION_ID = "io.modelcontextprotocol/ui";

export function hasUISupport(clientCapabilities: unknown): boolean {
  if (!clientCapabilities || typeof clientCapabilities !== "object") {
    return false;
  }

  const caps = clientCapabilities as Record<string, unknown>;
  const extensions = caps.extensions as Record<string, unknown> | undefined;

  if (!extensions) {
    return false;
  }

  const uiExtension = extensions[UI_EXTENSION_ID] as Record<string, unknown> | undefined;

  if (!uiExtension) {
    return false;
  }

  const mimeTypes = uiExtension.mimeTypes as string[] | undefined;

  if (!Array.isArray(mimeTypes)) {
    return false;
  }

  return mimeTypes.includes(UI_MIME_TYPE);
}
