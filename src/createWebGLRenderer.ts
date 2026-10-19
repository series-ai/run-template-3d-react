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
 * Probe whether the driver reports a major performance caveat: try to create
 * a throwaway context with `failIfMajorPerformanceCaveat: true` on a scratch
 * canvas. If that fails while our caveat-tolerant context succeeded, we are
 * on a slow (usually software) path — even when WEBGL_debug_renderer_info is
 * unavailable or reports an unrecognized renderer name.
 */
function hasMajorPerformanceCaveat(renderer: THREE.WebGLRenderer): boolean {
  // Probe with the same context type the real renderer got.
  const contextType =
    typeof WebGL2RenderingContext !== 'undefined' &&
    renderer.getContext() instanceof WebGL2RenderingContext
      ? 'webgl2'
      : 'webgl';
  try {
    const probe = document.createElement('canvas').getContext(contextType, {
      failIfMajorPerformanceCaveat: true,
    }) as WebGLRenderingContext | null;
    if (!probe) return true;
    // Free the scratch context promptly instead of waiting for GC.
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    return false;
  } catch {
    return true;
  }
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
 *   3. Disable shadows when the context is degraded (driver reports a major
 *      performance caveat, or a known software rasterizer is detected).
 *
 * Throws {@link WebGLUnavailableError} only if every attempt fails
 * (i.e. WebGL is genuinely unavailable).
 */
export function createWebGLRenderer(): CreateWebGLRendererResult {
  const attempt = (antialias: boolean): THREE.WebGLRenderer =>
    new THREE.WebGLRenderer({ antialias, powerPreference: 'high-performance' });

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = attempt(true);
  } catch {
    try {
      renderer = attempt(false);
    } catch (err) {
      throw new WebGLUnavailableError(err);
    }
  }

  // Two independent degradation signals: the driver flagging a major
  // performance caveat, and a known software-rasterizer name. The string
  // heuristic alone can miss (the debug extension may be unavailable or the
  // name unrecognized), so either signal marks the context degraded.
  const degraded = hasMajorPerformanceCaveat(renderer) || isSoftwareRenderer(renderer);
  if (degraded) {
    renderer.shadowMap.enabled = false;
  }

  return { renderer, degraded };
}
