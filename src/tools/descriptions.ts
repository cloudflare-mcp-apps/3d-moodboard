/**
 * Tool Descriptions and Metadata for 3D Abstract Moodboard MCP
 *
 * Centralized metadata for all MCP server tools.
 * Follows the 4-part description pattern from TOOL_DESCRIPTION_BEST_PRACTICES.md
 */

export interface ToolMetadata {
  title: string;
  description: {
    part1_purpose: string;
    part2_returns: string;
    part3_useCase: string;
    part4_constraints: string;
  };
  examples: {
    scenario: string;
    description: string;
  }[];
}

export const TOOL_METADATA = {
  "generate_mood_scene": {
    title: "Generate Mood Scene",

    description: {
      part1_purpose:
        "Generates dynamic Three.js code for abstract 3D art installations based on an emotion or abstract concept.",

      part2_returns:
        "Returns JavaScript code for Three.js scene with geometries, materials, lighting, and animation, plus the emotion name and canvas height.",

      part3_useCase:
        "Use this when the user wants to visualize an emotion, feeling, or abstract concept as an interactive 3D art installation.",

      part4_constraints:
        "Note: The code is executed in a sandboxed canvas with OrbitControls. Complexity ranges from 1-10 and affects object count. Higher complexity may impact performance on mobile devices."
    },

    examples: [
      {
        scenario: "Visualize peace",
        description: "Generate a calming scene with floating spheres and soft blue colors"
      },
      {
        scenario: "Show chaos",
        description: "Generate an intense scene with sharp geometries and high-contrast colors"
      },
      {
        scenario: "Express energy",
        description: "Generate a dynamic scene with vibrant colors and rapid animations"
      }
    ]
  } as const satisfies ToolMetadata,

  "learn_mood_primitives": {
    title: "Learn Mood Primitives",

    description: {
      part1_purpose:
        "Retrieves documentation and code examples for abstract visual techniques available in the Three.js widget.",

      part2_returns:
        "Returns Markdown-formatted documentation covering geometries, materials, lighting effects, and animation patterns with code snippets.",

      part3_useCase:
        "Use this to understand available Three.js primitives before generating a scene, or to learn specific techniques for visual effects.",

      part4_constraints:
        "Note: This is a documentation-only tool with no visual output. Use generate_mood_scene to create actual scenes."
    },

    examples: [
      {
        scenario: "Learn geometries",
        description: "Get documentation on available Three.js geometry types"
      },
      {
        scenario: "Learn materials",
        description: "Get documentation on material types and their properties"
      },
      {
        scenario: "Learn all techniques",
        description: "Get comprehensive documentation on all available visual techniques"
      }
    ]
  } as const satisfies ToolMetadata,

} as const;

export type ToolName = keyof typeof TOOL_METADATA;

export function getToolDescription(toolName: ToolName): string {
  const meta = TOOL_METADATA[toolName];
  const { part1_purpose, part2_returns, part3_useCase, part4_constraints } = meta.description;

  return `${part1_purpose} ${part2_returns} ${part3_useCase} ${part4_constraints}`;
}

export function getToolExamples(toolName: ToolName): readonly { scenario: string; description: string }[] {
  return TOOL_METADATA[toolName].examples;
}
