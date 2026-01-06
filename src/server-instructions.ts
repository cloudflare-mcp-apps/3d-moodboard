/**
 * Server Instructions for 3D Abstract Moodboard MCP
 *
 * Injected into LLM system prompt during MCP initialization.
 * Provides tool usage context, creative guidelines, and technical constraints.
 */

export const SERVER_INSTRUCTIONS = `
3D Abstract Moodboard - Generate interactive Three.js art installations from emotional prompts.

## Available Tools

### generate_mood_scene
Generates dynamic Three.js code for abstract 3D art installations based on an emotion or concept.
- Input: emotion (required), complexity (1-10, optional), height (pixels, optional)
- Output: Three.js JavaScript code executed in the widget
- Widget: Displays interactive 3D scene with OrbitControls for exploration

### learn_mood_primitives
Get documentation and examples for abstract visual techniques in Three.js.
- Input: category (geometries, materials, lighting, animation, or all)
- Output: Markdown documentation with code examples

## Creative Guidelines

When generating scenes, follow these emotional mappings:

- **Peace/Serenity**: Soft blue/teal colors (#7ec8e3), floating spheres, slow easing animations
- **Energy/Excitement**: Vibrant reds/oranges, sharp geometries (Icosahedrons, Octahedrons), rapid movement
- **Chaos/Intensity**: High-contrast colors, random particle positions, glitch-like motion, multiple materials
- **Curiosity/Wonder**: Gradients, nested shapes, gentle pulsing effects, emissive materials
- **Joy/Happiness**: Bright yellows and pinks, bouncing animations, rounded shapes
- **Melancholy/Sadness**: Deep blues and purples, slow falling particles, fog effects

## Technical Constraints

- Keep light intensity <= 1 to avoid overexposure
- Use UnrealBloomPass for glowing "neon" effects
- Use MeshStandardMaterial for realistic lighting interactions
- Always set renderer.setClearColor() to a dark background (0x1a1a2e recommended)
- Always include OrbitControls to allow user exploration
- Use requestAnimationFrame for smooth animations

## Available Three.js Globals in Widget

\`\`\`javascript
THREE           // Three.js library (r181)
canvas          // Pre-created canvas element
width, height   // Canvas dimensions in pixels
OrbitControls   // Interactive camera controls
EffectComposer  // Post-processing composer
RenderPass      // Render pass
UnrealBloomPass // Bloom effect for glow
\`\`\`

## Example Queries

"Visualize serenity" → generate_mood_scene(emotion: "serenity", complexity: 3)
"Show me chaos" → generate_mood_scene(emotion: "chaos", complexity: 8)
"Create an energetic scene" → generate_mood_scene(emotion: "energy", complexity: 6)
"What geometries can I use?" → learn_mood_primitives(category: "geometries")

## Performance Expectations

- Widget load time: < 2 seconds
- Scene generation: < 3 seconds (including AI prompt enhancement)
- Streaming preview: Code appears as it's generated

## Limitations

- No persistent scene storage (scenes are generated on-the-fly)
- No VR/AR support in this version
- Complex scenes (complexity > 8) may affect performance on mobile devices
`.trim();

export default SERVER_INSTRUCTIONS;
