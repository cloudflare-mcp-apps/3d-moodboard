/**
 * 3D Moodboard Widget
 *
 * Interactive Three.js scene renderer for emotional/abstract visualizations.
 * Based on threejs-server example with streaming code preview.
 */
import { StrictMode, useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import type { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// ============================================================================
// Types
// ============================================================================

interface MoodboardToolInput {
  code?: string;
  emotion?: string;
  height?: number;
}

interface WidgetProps {
  toolInputs: MoodboardToolInput | null;
  toolInputsPartial: MoodboardToolInput | null;
  toolResult: CallToolResult | null;
  hostContext: McpUiHostContext | null;
  callServerTool: App['callServerTool'];
  sendMessage: App['sendMessage'];
  openLink: App['openLink'];
  sendLog: App['sendLog'];
}

// ============================================================================
// Constants
// ============================================================================

const APP_INFO = { name: '3D Moodboard Widget', version: '1.0.0' };
const DEFAULT_HEIGHT = 600;

// Default demo code shown when no code is provided
const DEFAULT_THREEJS_CODE = `const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(width, height);
renderer.setClearColor(0x1a1a2e);

// Create floating spheres with soft colors
const spheres = [];
const colors = [0x7ec8e3, 0xb4e7ce, 0xf5d9e8, 0xfef9c7];

for (let i = 0; i < 12; i++) {
  const geometry = new THREE.SphereGeometry(0.3 + Math.random() * 0.3, 32, 32);
  const material = new THREE.MeshStandardMaterial({
    color: colors[i % colors.length],
    roughness: 0.4,
    metalness: 0.1,
  });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.set(
    (Math.random() - 0.5) * 6,
    (Math.random() - 0.5) * 4,
    (Math.random() - 0.5) * 4
  );
  sphere.userData = {
    offset: Math.random() * Math.PI * 2,
    speed: 0.3 + Math.random() * 0.5,
    amplitude: 0.5 + Math.random() * 0.5,
  };
  scene.add(sphere);
  spheres.push(sphere);
}

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 0.8);
light.position.set(3, 5, 3);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404060, 0.6));

// OrbitControls for user exploration
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

camera.position.z = 6;

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  const time = Date.now() * 0.001;

  spheres.forEach((sphere) => {
    const { offset, speed, amplitude } = sphere.userData;
    sphere.position.y += Math.sin(time * speed + offset) * 0.005 * amplitude;
  });

  controls.update();
  renderer.render(scene, camera);
}
animate();`;

// Context object passed to user code
const threeContext = {
  THREE,
  OrbitControls,
  EffectComposer,
  RenderPass,
  UnrealBloomPass,
};

// ============================================================================
// Helpers
// ============================================================================

async function executeThreeCode(
  code: string,
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): Promise<void> {
  const fn = new Function(
    'ctx',
    'canvas',
    'width',
    'height',
    `const { THREE, OrbitControls, EffectComposer, RenderPass, UnrealBloomPass } = ctx;
     return (async () => { ${code} })();`
  );
  await fn(threeContext, canvas, width, height);
}

// ============================================================================
// Loading Shimmer Component
// ============================================================================

function LoadingShimmer({ height, code, emotion }: { height: number; code?: string; emotion?: string }) {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [code]);

  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: 8,
        padding: 16,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'linear-gradient(90deg, #1a1a2e 25%, #2d2d44 50%, #1a1a2e 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
      }}
    >
      <div
        style={{
          color: '#888',
          fontFamily: 'system-ui',
          fontSize: 12,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>🎨 Generating</span>
        {emotion && <span style={{ color: '#7ec8e3' }}>&quot;{emotion}&quot;</span>}
      </div>
      {code && (
        <pre
          ref={preRef}
          style={{
            margin: 0,
            padding: 0,
            flex: 1,
            overflow: 'auto',
            color: '#aaa',
            fontFamily: 'monospace',
            fontSize: 11,
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {code}
        </pre>
      )}
    </div>
  );
}

// ============================================================================
// Main Moodboard App Component
// ============================================================================

function MoodboardApp({
  toolInputs,
  toolInputsPartial,
}: WidgetProps) {
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const height = toolInputs?.height ?? toolInputsPartial?.height ?? DEFAULT_HEIGHT;
  const code = toolInputs?.code || DEFAULT_THREEJS_CODE;
  const emotion = toolInputs?.emotion ?? toolInputsPartial?.emotion;
  const partialCode = toolInputsPartial?.code;
  const isStreaming = !toolInputs && !!toolInputsPartial;

  useEffect(() => {
    if (!code || !canvasRef.current || !containerRef.current) return;

    setError(null);
    const width = containerRef.current.offsetWidth || 800;

    executeThreeCode(code, canvasRef.current, width, height).catch((e) =>
      setError(e instanceof Error ? e.message : 'Unknown error')
    );
  }, [code, height]);

  if (isStreaming || !toolInputs) {
    return <LoadingShimmer height={height} code={partialCode} emotion={emotion} />;
  }

  return (
    <div ref={containerRef} className="threejs-container" style={{ position: 'relative' }}>
      {emotion && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 10,
            background: 'rgba(26, 26, 46, 0.8)',
            padding: '8px 12px',
            borderRadius: 6,
            color: '#7ec8e3',
            fontFamily: 'system-ui',
            fontSize: 13,
          }}
        >
          🎨 {emotion}
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height,
          borderRadius: 8,
          display: 'block',
          background: '#1a1a2e',
        }}
      />
      {error && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            right: 12,
            zIndex: 20,
            background: 'rgba(220, 38, 38, 0.9)',
            padding: '12px 16px',
            borderRadius: 8,
            color: '#fff',
            fontFamily: 'system-ui',
            fontSize: 13,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MCP App Wrapper
// ============================================================================

function McpAppWrapper() {
  const [toolInputs, setToolInputs] = useState<MoodboardToolInput | null>(null);
  const [toolInputsPartial, setToolInputsPartial] = useState<MoodboardToolInput | null>(null);
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | null>(null);

  const { app, error } = useApp({
    appInfo: APP_INFO,
    capabilities: {},
    onAppCreated: (appInstance) => {
      // Complete tool input (streaming finished)
      appInstance.ontoolinput = (params) => {
        setToolInputs(params.arguments as MoodboardToolInput);
        setToolInputsPartial(null);
      };

      // Partial tool input (streaming in progress)
      appInstance.ontoolinputpartial = (params) => {
        setToolInputsPartial(params.arguments as MoodboardToolInput);
      };

      // Tool execution result
      appInstance.ontoolresult = (params) => {
        setToolResult(params as CallToolResult);
      };

      // Host context changes (theme, viewport, etc.)
      appInstance.onhostcontextchanged = (context) => {
        setHostContext(context);
        // Apply dark mode by default for this widget
        document.documentElement.classList.add('dark');
      };

      // Error handler
      appInstance.onerror = (err) => {
        console.error('[Moodboard] Error:', err);
      };

      // Teardown handler
      appInstance.onteardown = async () => {
        return {};
      };
    },
  });

  // Memoized callbacks
  const callServerTool = useCallback<App['callServerTool']>(
    (params, options) => app!.callServerTool(params, options),
    [app]
  );
  const sendMessage = useCallback<App['sendMessage']>(
    (params, options) => app!.sendMessage(params, options),
    [app]
  );
  const openLink = useCallback<App['openLink']>(
    (params, options) => app!.openLink(params, options),
    [app]
  );
  const sendLog = useCallback<App['sendLog']>(
    (params) => app!.sendLog(params),
    [app]
  );

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  if (!app) {
    return <div className="loading">Connecting...</div>;
  }

  return (
    <MoodboardApp
      toolInputs={toolInputs}
      toolInputsPartial={toolInputsPartial}
      toolResult={toolResult}
      hostContext={hostContext}
      callServerTool={callServerTool}
      sendMessage={sendMessage}
      openLink={openLink}
      sendLog={sendLog}
    />
  );
}

// ============================================================================
// Mount App
// ============================================================================

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <McpAppWrapper />
    </StrictMode>
  );
}
