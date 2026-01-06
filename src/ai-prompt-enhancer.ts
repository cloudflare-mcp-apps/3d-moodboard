/**
 * AI Prompt Enhancer for 3D Abstract Moodboard
 *
 * Uses Workers AI to convert emotional prompts into detailed Three.js code.
 * Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast
 */

import { SERVER_INSTRUCTIONS } from "./server-instructions";

const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/**
 * Generates Three.js code from an emotion/concept using Workers AI
 *
 * @param ai - Workers AI binding
 * @param emotion - The emotion or concept to visualize
 * @param complexity - Complexity level 1-10 (affects object count)
 * @param gatewayId - Optional AI Gateway ID for logging/caching
 * @returns Three.js JavaScript code string
 */
export async function enhanceEmotionToThreeJS(
  ai: Ai,
  emotion: string,
  complexity: number = 5,
  gatewayId?: string
): Promise<string> {
  const systemPrompt = `You are an expert Three.js developer creating abstract art installations.
Your code will be executed in a sandboxed environment with these globals:
- THREE (Three.js library r181)
- canvas (pre-created canvas element)
- width, height (canvas dimensions)
- OrbitControls (for camera controls)
- EffectComposer, RenderPass, UnrealBloomPass (for post-processing)

REQUIREMENTS:
1. Create a complete, self-contained scene
2. Always include OrbitControls for user exploration
3. Use requestAnimationFrame for animations
4. Set renderer.setClearColor() to a dark color
5. Keep light intensity <= 1
6. Use MeshStandardMaterial for most objects
7. The complexity parameter ${complexity}/10 means include roughly ${Math.floor(5 + complexity * 2)} objects

EMOTIONAL MAPPINGS:
${SERVER_INSTRUCTIONS.split('## Creative Guidelines')[1]?.split('## Technical Constraints')[0] || ''}

Return ONLY executable JavaScript code. No markdown, no explanations, no code blocks.`;

  const userPrompt = `Generate Three.js code for the emotion: "${emotion}" with complexity ${complexity}/10.

The scene should visually represent the feeling of "${emotion}" using abstract 3D shapes, appropriate colors, lighting, and animations.

Remember:
- Include OrbitControls for camera manipulation
- Use appropriate colors and shapes for the emotion
- Add smooth animations that reinforce the mood
- Keep code clean and efficient`;

  const options: Record<string, unknown> = {};
  if (gatewayId) {
    options.gateway = {
      id: gatewayId,
      cacheTtl: 3600, // Cache for 1 hour
    };
  }

  const response = await ai.run(
    AI_MODEL,
    {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    },
    options
  );

  // Extract the response text
  const code = typeof response === "object" && "response" in response
    ? (response as { response: string }).response
    : String(response);

  // Clean up the response - remove markdown code blocks if present
  return cleanupCode(code);
}

/**
 * Cleans up AI-generated code by removing markdown artifacts
 */
function cleanupCode(code: string): string {
  let cleaned = code.trim();

  // Remove markdown code blocks if present
  if (cleaned.startsWith("```javascript")) {
    cleaned = cleaned.slice("```javascript".length);
  } else if (cleaned.startsWith("```js")) {
    cleaned = cleaned.slice("```js".length);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

/**
 * Documentation content for learn_mood_primitives tool
 */
export const MOOD_PRIMITIVES_DOCUMENTATION = {
  geometries: `# Three.js Geometries for Abstract Art

## Basic Shapes
\`\`\`javascript
// Sphere - Great for peaceful, organic moods
new THREE.SphereGeometry(radius, widthSegments, heightSegments)

// Box - Solid, stable, structured moods
new THREE.BoxGeometry(width, height, depth)

// Icosahedron - Energetic, complex moods
new THREE.IcosahedronGeometry(radius, detail)

// Octahedron - Sharp, dynamic moods
new THREE.OctahedronGeometry(radius, detail)

// Torus - Flowing, continuous moods
new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments)

// TorusKnot - Complex, intricate moods
new THREE.TorusKnotGeometry(radius, tube, tubularSegments, radialSegments)
\`\`\`

## Particle Systems
\`\`\`javascript
// Points for particle effects
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(count * 3);
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const points = new THREE.Points(geometry, pointsMaterial);
\`\`\`
`,

  materials: `# Three.js Materials for Mood Expression

## Standard Material (Recommended)
\`\`\`javascript
// Best for realistic lighting
new THREE.MeshStandardMaterial({
  color: 0x7ec8e3,      // Soft blue for peace
  roughness: 0.4,        // Lower = more reflective
  metalness: 0.1,        // Higher = more metallic
  emissive: 0x000000,    // Self-illumination color
  emissiveIntensity: 0   // Glow strength
})
\`\`\`

## Emissive/Glow Effects
\`\`\`javascript
// For neon/glow effects
new THREE.MeshStandardMaterial({
  color: 0xff00ff,
  emissive: 0xff00ff,
  emissiveIntensity: 0.5
})
// Combine with UnrealBloomPass for best results
\`\`\`

## Color Palettes by Mood
- **Peace**: #7ec8e3, #b4e7ce, #f5d9e8 (soft pastels)
- **Energy**: #ff4444, #ff8800, #ffff00 (warm, vibrant)
- **Chaos**: High contrast pairs, random hues
- **Sadness**: #2d3436, #636e72, #b2bec3 (muted blues/grays)
`,

  lighting: `# Three.js Lighting for Atmosphere

## Basic Setup
\`\`\`javascript
// Always include ambient light
scene.add(new THREE.AmbientLight(0x404040, 0.6));

// Main directional light (keep intensity <= 1)
const light = new THREE.DirectionalLight(0xffffff, 0.8);
light.position.set(3, 5, 3);
scene.add(light);
\`\`\`

## Mood-Specific Lighting
\`\`\`javascript
// Peaceful - soft, even lighting
new THREE.AmbientLight(0x404060, 0.8);
new THREE.DirectionalLight(0xffffff, 0.5);

// Energetic - strong contrasts
new THREE.PointLight(0xff4400, 1, 10);
new THREE.SpotLight(0xffff00, 0.8);

// Mysterious - low ambient, focused spots
new THREE.AmbientLight(0x101020, 0.3);
new THREE.SpotLight(0x0066ff, 0.7, 10, Math.PI / 6);
\`\`\`

## Post-Processing Bloom
\`\`\`javascript
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(
  new THREE.Vector2(width, height),
  0.5,  // strength
  0.4,  // radius
  0.85  // threshold
));
// Use composer.render() instead of renderer.render()
\`\`\`
`,

  animation: `# Three.js Animation Patterns

## Basic Animation Loop
\`\`\`javascript
function animate() {
  requestAnimationFrame(animate);

  // Update objects
  cube.rotation.y += 0.01;

  // Update controls if using OrbitControls
  controls.update();

  renderer.render(scene, camera);
}
animate();
\`\`\`

## Floating Motion (Peace)
\`\`\`javascript
const time = Date.now() * 0.001;
object.position.y += Math.sin(time * speed + offset) * 0.005;
\`\`\`

## Pulsing Effect (Energy)
\`\`\`javascript
const scale = 1 + Math.sin(time * 3) * 0.1;
object.scale.setScalar(scale);
\`\`\`

## Orbital Motion
\`\`\`javascript
object.position.x = Math.cos(time * speed) * radius;
object.position.z = Math.sin(time * speed) * radius;
\`\`\`

## Chaotic Movement
\`\`\`javascript
object.position.x += (Math.random() - 0.5) * 0.02;
object.position.y += (Math.random() - 0.5) * 0.02;
object.rotation.x += (Math.random() - 0.5) * 0.01;
\`\`\`

## Easing Functions
\`\`\`javascript
// Smooth ease-in-out
const eased = (1 - Math.cos(progress * Math.PI)) / 2;

// Bounce
const bounce = Math.abs(Math.sin(time * 5)) * 0.5;
\`\`\`
`,

  all: "", // Will be populated below
};

// Combine all documentation for "all" category
MOOD_PRIMITIVES_DOCUMENTATION.all = `# Three.js Mood Primitives - Complete Reference

${MOOD_PRIMITIVES_DOCUMENTATION.geometries}

---

${MOOD_PRIMITIVES_DOCUMENTATION.materials}

---

${MOOD_PRIMITIVES_DOCUMENTATION.lighting}

---

${MOOD_PRIMITIVES_DOCUMENTATION.animation}
`;

export type MoodPrimitivesCategory = keyof typeof MOOD_PRIMITIVES_DOCUMENTATION;
