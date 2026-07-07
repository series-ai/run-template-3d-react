import * as THREE from 'three';

/**
 * Thrown by {@link createWebGLRenderer} when no WebGL context can be created
 * at all. Catch this (e.g. with `instanceof`) to show a friendly fallback UI
 * instead of a generic crash screen.
 */
export class WebGLUnavailableError extends Error {
  readonly cause?: unknown;

  constructor(cause?: unknown) {
    super('WebGL is not available on this device/browser');
    this.name = 'WebGLUnavailableError';
    this.cause = cause;
  }
}

export interface CreateWebGLRendererResult {
  renderer: THREE.WebGLRenderer;
  /**
   * True when the browser fell back to a software rasterizer (no GPU).
   * The renderer already has shadow maps disabled in that case; use this
   * flag to skip other expensive setup (shadow-casting lights, etc.).
   */
  degraded: boolean;
}

/** Matches known software rasterizers reported via WEBGL_debug_renderer_info. */
const SOFTWARE_RENDERER_PATTERN = /swiftshader|llvmpipe|basic render|software/i;

function isSoftwareRenderer(renderer: THREE.WebGLRenderer): boolean {
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (!debugInfo) return false;
  const gpu = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
  return SOFTWARE_RENDERER_PATTERN.test(gpu);
}

/**
 * Create a THREE.WebGLRenderer that degrades gracefully instead of crashing.
 *
 * Software GPUs are surprisingly common (Windows with hardware acceleration
 * turned off, remote desktops, old drivers). Passing
 * `failIfMajorPerformanceCaveat: true` makes context creation throw on those
 * machines, which crashes the game and leaves the platform load screen
 * hanging. So instead we:
 *
 *   1. Allow software rendering (no `failIfMajorPerformanceCaveat`).
 *   2. Retry without antialiasing if context creation fails.
 *   3. Disable shadows when running on a software rasterizer.
 *
 * Throws {@link WebGLUnavailableError} only if every attempt fails
 * (i.e. WebGL is genuinely unavailable).
 */
export function createWebGLRenderer(): CreateWebGLRendererResult {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch {
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      throw new WebGLUnavailableError(err);
    }
  }

  const degraded = isSoftwareRenderer(renderer);
  if (degraded) {
    renderer.shadowMap.enabled = false;
  }

  return { renderer, degraded };
}
