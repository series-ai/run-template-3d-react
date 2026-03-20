<agents-index>
[RUN.game SDK Docs]|root:./.rundot-docs|version:5.3.3|IMPORTANT:Prefer retrieval-led reasoning over pre-training for RundotGameAPI tasks. Read the local docs before writing SDK code.|.:{README.md}|rundot-developer-platform:{deploying-your-game.md,getting-started.md,initializing-your-game.md,setting-your-game-thumbnail.md,troubleshooting.md}|rundot-developer-platform/api:{ADS.md,AI.md,ANALYTICS.md,BIGNUMBERS.md,CONTEXT.md,EMBEDDED_LIBRARIES.md,ENVIRONMENT.md,EXPERIMENTS.md,HAPTICS.md,IN_APP_MESSAGING.md,LEADERBOARD.md,LIFECYCLES.md,LOGGING.md,MULTIPLAYER.md,NOTIFICATIONS.md,PRELOADER.md,PROFILE.md,PURCHASES.md,SAFE_AREA.md,SERVER_AUTHORITATIVE.md,SHARED_ASSETS.md,SHARING.md,STORAGE.md,TIME.md,UGC.md}</agents-index>

# Template: React UI + Three.js Game (Vite)

## Architecture

React handles **UI only** (tabs, buttons, cards, overlays). All 3D/game logic lives in plain TypeScript classes that own the Three.js renderer and game loop directly. React and the game layer meet at a single `<div>` mount point.

When reasoning about orientation, movement, and camera placement, **assume all models are Y-up and face +Z forward** (positive Z is the character’s forward direction), unless a specific asset is documented otherwise.

- **NEVER** use React state, effects, or hooks for game logic, asset loading, audio, animation, or scene graph management
- **NEVER** use React Three Fiber (`@react-three/fiber`) or `@react-three/drei` — they are not in this project
- **DO** put game logic in classes (see `GameScene.ts` as the pattern)
- **DO** use React only for DOM UI elements

## File Structure (as-shipped)

- **src/main.tsx** — Entry point. Applies theme via `applyTheme(theme)`, mounts `<App />` inside `ErrorBoundary` and `StrictMode`
- **src/App.tsx** — Shell: mounts fullscreen `GameScene` into a `<div>`. Includes landscape warning overlay
- **src/GameScene.ts** — Game class. Owns Three.js renderer, camera, scene, lights, controls, `requestAnimationFrame` loop, and asset loading. Extend this for game logic
- **src/loadStowKitPack.ts** — Plain async function to load StowKit `.stow` packs. Has a simple cache. No React
- **src/components/** — Reusable UI: `Button`, `Card`, `Stack`, `ErrorBoundary`
- **src/theme/** — Design tokens: `default.ts`, `types.ts`, `applyTheme.ts`. CSS variables set on `document.documentElement`
- **src/style.css** — Global styles; uses theme CSS variables (e.g. `--color-primary`, `--spacing-md`)
- **public/** — Static assets. Small essentials here; large assets in **public/cdn-assets/** (deployed to CDN via `rundot deploy`)
- **vite.config.ts** — Vite + `@vitejs/plugin-react` + `rundotGameLibrariesPlugin()` from SDK; `base: './'`; esbuild/build target `es2022`

## Key Patterns

- **3D/Game:** All game logic goes in plain TypeScript classes. `GameScene` owns the Three.js `WebGLRenderer`, camera, scene, and `requestAnimationFrame` loop. Load assets with `loadStowKitPack()`. Use `three` directly — `OrbitControls` from `three/addons/controls/OrbitControls.js`, etc. React never touches the scene graph.
- **StowKit loading:** Always use `loadStowKitPack(packName)` from `src/loadStowKitPack.ts` — it handles CDN fetch, WASM config, and caching. Never load `.stow` files directly with `StowKitLoader.load()` in this template (CDN requires `RundotGameAPI.cdn.fetchAsset`).
- **React ↔ Game boundary:** React renders a `<div>`, passes it to the game class on mount, and calls `dispose()` on unmount. That's it. If the game needs to communicate state to the UI (e.g. score, health), expose it via callbacks or an event emitter — not React state driving the game.
- **RundotGameAPI:** Import `RundotGameAPI from '@series-inc/rundot-game-sdk/api'`. Use `RundotGameAPI.cdn.fetchAsset('filename.png')` (returns Promise<Blob>) for CDN assets; `RundotGameAPI.appStorage` for persistence; `RundotGameAPI.ads`, `RundotGameAPI.popups`, `RundotGameAPI.triggerHapticAsync`, `RundotGameAPI.system.getSafeArea()` / `getDevice()` / `getEnvironment()`; `RundotGameAPI.error()` for logging. No initialization in code — SDK is wired by Vite plugin.
- **Theme:** Edit `src/theme/default.ts`. `applyTheme(theme)` runs once in main.tsx; CSS uses variables like `var(--color-primary)`.

## What to Modify

- **New 3D game logic** — Extend `GameScene` in `src/GameScene.ts` or create new game classes. Load assets with `loadStowKitPack()`. All game logic stays in plain TypeScript — no React hooks or state.
- **New CDN assets** — Add files to `public/cdn-assets/`; load in code with `RundotGameAPI.cdn.fetchAsset('filename.ext')`. Use `public/` for small assets referenced by path.
- **Look and feel** — `src/theme/default.ts` and `src/style.css`.
- **Build/deploy** — `npm run build`; `rundot deploy` for production (includes CDN upload). Optional: `RUNDOT_GAME_DISABLE_EMBEDDED_LIBS=true` for bundled build.

## StowKit Asset Pipeline

**Adding assets is always a two-step process:**
1. Place source file (FBX, GLB, PNG, WAV) in `assets/`, run `stowkit build`
2. Load from `.stow` pack in game code: `pack.loadMesh('stringId')`, `pack.loadTexture('stringId')`, etc.

- **NEVER** load raw source files directly (`THREE.FBXLoader`, `THREE.TextureLoader`, `THREE.GLTFLoader`, `fetch('assets/...')`)
- **NEVER** manually create `.stowmeta` files — they are auto-generated by `stowkit build`
- **NEVER** use `stowkit store` commands to find local project files — the store is a remote shared registry
- To find local assets: glob `assets/`, read `.stowmeta` files, or run `stowkit status`
- To add an asset: place file in `assets/` → `stowkit build` → use `loadStowKitPack('default')` then `pack.loadMesh()`/`pack.loadTexture()`/etc.
- **CRITICAL: Always run `stowkit build` after adding or modifying any file in `assets/`.** The `.stow` bundle in `public/cdn-assets/` is what the game actually loads at runtime — if you skip the build, new/changed assets won't exist in the pack and `loadMesh()`/`loadTexture()`/etc. will fail silently or throw. This is the #1 forgotten step.
- **Sounds/Audio:** When the user asks for sounds, **first** use the MCP asset store search to find existing sounds — there are many available. Only create/synthesize sounds as a last resort if nothing suitable exists in the store.

## UI Design Guidelines

This runs on phones. Design for **portrait, touch, one-thumb reach**.

### Visual Design — This Is a Game, Not a SaaS Dashboard

Before writing ANY UI code, decide on an aesthetic direction that fits the game (e.g. sci-fi/industrial, fantasy/ornate, casual/toy-like, minimalist/clean, retro/pixel, organic/natural). Commit to it. Every UI element should feel like it belongs in the game world.

**Theme Colors:**
- Pick ONE dominant accent color that matches the game's mood. Add 1–2 supporting accents max. Do not evenly distribute 5 pastel colors — that's a SaaS palette, not a game.
- Update `src/theme/default.ts` FIRST — set `primary`, `secondary`, `background`, `surface` to match the game's world. Every UI element pulls from these tokens. A space game gets deep blues and cyan accents. A dungeon crawler gets warm stone and gold. A casual game gets bright, saturated primaries.
- **NEVER** use the default purple/blue gradient as shipped — it's a placeholder, not a design choice.

**Dark/Translucent Panels (not white cards):**
- Game UI panels use dark translucent backgrounds: `background: rgba(0, 0, 0, 0.65)` with `backdrop-filter: blur(4px)` — the 3D scene should bleed through.
- **NEVER** use opaque white or light gray backgrounds for any game UI element. This is a game running over a 3D scene — white cards look completely wrong.
- Borders are subtle: `1px solid rgba(255, 255, 255, 0.08)`. Not thick, not high-contrast, not colored borders on every panel.

**Border Radius:**
- Keep it tight: **2–6px**. Games use sharp, intentional corners. `border-radius: 24px` pill shapes are a SaaS/AI-slop tell.
- Exception: circular elements (avatar badges, round buttons) use `border-radius: 50%` — that's geometric, not decorative.

**Typography:**
- **NEVER** use Inter, Roboto, Open Sans, Arial, Lato, or default system fonts. These are invisible — they have zero personality and scream "template."
- Choose a font with character that fits the game: Space Grotesk, Exo 2, Rajdhani, Orbitron (sci-fi), Chakra Petch, Press Start 2P (retro), Fredoka (casual), Cinzel (fantasy). Load via Google Fonts or bundle it.
- HUD values (score, health, timer): use `font-variant-numeric: tabular-nums` so digits don't shift width, plus `text-shadow: 0 1px 3px rgba(0,0,0,0.8)` for readability over the 3D scene.
- Labels and button text: `text-transform: uppercase` + `letter-spacing: 0.05–0.1em` reads as game UI, not web UI.

**Buttons:**
- Game buttons are solid accent color with a subtle lighter border (`2px solid rgba(255,255,255,0.12)`), uppercase text, tight radius.
- `:active` state is mandatory (`:hover` doesn't exist on phones): `transform: scale(0.95)` for tactile press feel.
- **NEVER** use gradient fills on buttons as a default. Flat solid color > generic linear-gradient.
- No `box-shadow: 0 4px 6px rgba(0,0,0,0.1)` — that's a web card shadow. Game buttons either have no shadow or a tight colored glow matching the accent.

**Shadows & Effects:**
- Avoid generic `box-shadow` on everything. If you need depth, use `border` or subtle inner highlight (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.05)`).
- Reserve glow effects (`box-shadow: 0 0 12px var(--color-primary)`) for interactive/active states, not decoration.

**Icons:**
- Use icons over text labels during gameplay — players read icons at a glance, not sentences.
- Emoji icons are fine for prototyping. For polish, use a consistent icon set (Lucide, Phosphor, or custom SVGs).

**What NOT to Do (AI default behaviors to avoid):**
- No "three evenly-spaced cards in a row" layouts
- No hero sections, testimonials, or SaaS page patterns
- No glassmorphism as a default (heavy `backdrop-filter: blur(20px)` on everything)
- No scattered generic `fadeIn` animations on every element
- No pastel/muted color palettes — games need contrast and visual punch
- No `opacity: 0.5` as the disabled state — use `opacity: 0.35` + `grayscale(0.5)` to actually look disabled

**Motion & Feedback:**
- One coordinated entrance animation per screen/modal (elements stagger in). Not every element independently fading in.
- State changes animate meaningfully: health bar drains smoothly, score ticks up, currency flies to the counter.
- Button presses need instant visual feedback (scale, brightness shift, or flash) — a button that doesn't react to touch feels broken on mobile.
- Use CSS transitions on `transform`/`opacity` only (compositor-thread). See "Preventing Jitter" below.

### Layout & Layering
- The `.app-container` caps at 720×1280 (9:16) — design UI within this, not the full viewport
- The canvas (Three.js) composites as its own GPU layer. HTML overlays sit on top naturally — no `z-index` needed if they're siblings of `.scene-container`
- Game HUD overlays: use `position: absolute` within the game container (not `position: fixed` — there's no scrolling, and fixed creates unnecessary compositor layers). Set `pointer-events: none` on the overlay container, `pointer-events: auto` on interactive children only
- Use `RundotGameAPI.system.getSafeArea()` to inset UI away from notches/home indicators — apply returned padding to fixed overlays, not just the app shell
- For fullscreen game scenes (no tabs), hide the `TabBar` and let `.scene-container` fill the app container; overlay HUD elements as absolutely-positioned HTML siblings of the canvas div

### Preventing Jitter Between HTML Overlays and Canvas
- **Only animate `transform` and `opacity`** on overlay elements — these are the only two CSS properties handled by the compositor thread. Animating `top`, `left`, `width`, `height`, `margin`, `padding`, `box-shadow` etc. forces layout on the main thread and competes with your `requestAnimationFrame` game loop, causing mutual stutter
- Use `transform: translate(x, y)` instead of `top`/`left` for positioning animations
- `will-change: transform` promotes an element to its own compositor layer — but it's a **last resort for existing perf problems**, not preventative. Overuse wastes GPU memory. Toggle it via JS before/after animation, don't leave it in stylesheets permanently
- `will-change` creates a new stacking context eagerly — can break z-ordering unexpectedly
- Apply `contain: content` (shorthand for `layout paint style`) on overlay panels — tells the browser that DOM changes inside won't affect anything outside, so it can skip recalculating the rest of the page
- **Don't** re-render React on every game frame — if the game updates a score at 60fps, throttle the React update to every 100–200ms or use a ref + direct DOM mutation for the counter

### Canvas Sizing & DPI
- **Don't use `renderer.setPixelRatio()`** — Three.js docs recommend against it. It silently multiplies sizes behind the scenes and breaks post-processing, GPU picking, `gl_FragCoord`, and screenshot capture
- Instead, handle DPI manually: `const dpr = Math.min(window.devicePixelRatio, 2);` then `renderer.setSize(width * dpr, height * dpr, false)` (false = don't touch CSS). Cap at 2 because DPR 3 (modern iPhones) means 9x pixels — destroys mobile fill rate for minimal visual gain
- Use `ResizeObserver` on the container element, not `window.addEventListener('resize')` — it's element-level (catches tab switches, flexbox reflows), fires between layout and paint, and provides dimensions via `contentRect` without forcing `getBoundingClientRect()` layout thrashing
- **Don't** put `<canvas>` inside a scrollable container — causes janky resize. The canvas belongs in a fixed-size container

### Touch & Interaction
- Minimum touch target: **44×44px** — anything smaller is unusable on phone. Pad icons with transparent hit areas if needed
- Buttons need `:active` state feedback, not just `:hover` (hover doesn't exist on mobile) — use `transform: scale(0.95)` or opacity change on `:active`
- Set `touch-action: none` on the canvas container — prevents the browser from intercepting touches for pan, zoom, or double-tap-to-zoom. The browser resolves `touch-action` by intersecting values up the DOM tree, so setting it on the container covers all children
- If your game calls `preventDefault()` on touch events, you **must** use `{ passive: false }` — browsers default `touchstart`/`touchmove` to passive on window/document/body, and passive listeners silently ignore `preventDefault()`. Prefer `touch-action: none` in CSS over `preventDefault()` — it's more efficient (informs the browser before any event fires)
- For game controls overlaid on the canvas: use transparent `<div>` touch zones positioned over the canvas, **not** Three.js raycasting for UI buttons
- Use `RundotGameAPI.triggerHapticAsync()` on meaningful interactions (purchases, confirmations) — not on every tap
- **Prevent text selection and drag on HUD overlays** — emoji, score text, and other HUD content will get selected/dragged by the browser during thumbstick or button interactions. Always set `user-select: none; -webkit-user-select: none;` on the HUD root container. Add `e.preventDefault()` on `mousedown` handlers for draggable controls (thumbsticks, sliders) to prevent the browser's native drag behavior
- **Mouse-based drag controls (thumbsticks, sliders)** — always listen for `mousemove` and `mouseup` on `window`, not on the element itself. If the cursor leaves the element while dragging, the element-level listeners stop firing and the control gets stuck. Start the window listeners on `mousedown` and clean them up on `mouseup`

### Using the Theme System
- **Always use CSS variables** (`var(--color-primary)`, `var(--spacing-md)`) — never hardcode colors or sizes in component styles
- Update `src/theme/default.ts` to match the game's aesthetic BEFORE building any UI — the defaults are placeholders

### Game HUD Patterns
- Score/health/timer: absolutely-positioned HTML elements over the canvas — fast to update, accessible, styled with CSS. **Never** render HUD as 3D text or sprites
- Use the `Card` component for popup modals (game over, settings, shop) — it already has the right border, radius, and backdrop
- Animate HUD changes with CSS transitions on `transform`/`opacity` only (`--animation-fast` for score ticks, `--animation-normal` for panel slides) — don't use JS `requestAnimationFrame` for UI animation, that's for the game loop
- Communicate game state → React UI via an event emitter or callback on the game class (e.g. `onScoreChange`, `onGameOver`) — React subscribes in `useEffect`, updates local state. Game class never imports React

### Mobile Renderer Settings
- **`antialias`**: Native MSAA (`antialias: true`) is the cheapest AA when NOT using post-processing — but 4x MSAA quadruples the color buffer memory. On low-end mobile, skip AA and render at 1.25–1.5x DPR instead (CSS downscale provides implicit AA)
- **`preserveDrawingBuffer: false`** (default): Lets tiled-rendering mobile GPUs (Adreno, Mali, Apple) discard the framebuffer after compositing instead of writing it back to memory. Only set `true` if you need `canvas.toDataURL()` for screenshots
- **`alpha: true`**: MDN warns that `alpha: false` can be *more* expensive on some platforms (RGB backbuffer emulated on RGBA). Use `alpha: true` with shaders outputting `alpha: 1.0` if you want an opaque canvas. Set `premultipliedAlpha: false` if your blending assumes straight alpha
- **`powerPreference: 'high-performance'`**: Worth setting as a hint, but on mobile (single GPU) it has no effect. On laptops Chrome picks GPU based on AC/battery regardless
- **`failIfMajorPerformanceCaveat: true`**: Causes context creation to fail if the browser would use software rendering — better to show a fallback message than run at 2fps
- **NEVER** use `logarithmicDepthBuffer` — it uses `gl_FragDepth` which disables Early-Z testing on the GPU, devastating for mobile performance
- Keep draw calls under ~100–200 for 60fps on mid-range mobile — use `InstancedMesh` or merged geometries to reduce. Check `renderer.info.render.calls` to monitor

## Three.js Gotchas

- `DirectionalLight` targets: always `scene.add(dirLight.target)` — Three.js needs the target in the scene graph for shadow camera orientation
- `castShadow`/`receiveShadow` don't propagate to children — after loading a StowKit mesh, traverse to enable: `mesh.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } })`
- StowKit `pack.loadMesh()` returns a `THREE.Group` with nested children — always traverse when setting per-mesh properties
- Always call `renderer.shadowMap.enabled = true` and set `dirLight.castShadow = true` for shadows to work
- Near clipping plane (`camera.near`) too small causes z-fighting artifacts — if the camera zooms out far, increase `near` (e.g. `0.5` or `1` instead of `0.1`). Keep the near/far ratio reasonable (< 10000:1).

## Skinned Mesh + Animation

`clone(true)` on a `SkinnedMesh` does **NOT** rebind the skeleton — every clone still points at the original bones, so they all T-pose or move in unison. And calling `loadSkinnedMesh()` per instance is way too expensive (re-decodes geometry + textures from scratch). The correct pattern is **load once, clone with rebind**.

### Step 1 — Load template once (expensive, do it once at startup)
```ts
this.enemyTemplate = await pack.loadSkinnedMesh('character/my_character');
this.enemyWalkClip = await pack.loadAnimationClip('animations/anim_walk');
// Don't add the template to the scene — it's just a source to clone from
```

### Step 2 — Clone helper (rebinds skeleton to cloned bones)
```ts
function cloneSkinnedMesh(source: THREE.Group): THREE.Group {
  const clone = source.clone(true);

  const sourceBones: THREE.Bone[] = [];
  const cloneBones: THREE.Bone[] = [];
  source.traverse((n) => { if ((n as THREE.Bone).isBone) sourceBones.push(n as THREE.Bone); });
  clone.traverse((n) =>  { if ((n as THREE.Bone).isBone) cloneBones.push(n as THREE.Bone); });

  clone.traverse((n) => {
    const sm = n as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh) return;
    const newBones = sm.skeleton.bones.map(
      (b) => cloneBones[sourceBones.indexOf(b)] ?? b
    );
    sm.skeleton = new THREE.Skeleton(newBones, sm.skeleton.boneInverses);
    sm.bind(sm.skeleton, sm.bindMatrix);
  });

  return clone;
}
```

### Step 3 — Per spawn (cheap — just a CPU-side array remap)
```ts
const charGroup = cloneSkinnedMesh(this.enemyTemplate);
scene.add(charGroup);
const mixer = new THREE.AnimationMixer(charGroup);
mixer.clipAction(this.enemyWalkClip).play();
```

### Step 4 — Every frame
```ts
mixer.update(delta);
```

### Step 5 — On death/removal
```ts
mixer.stopAllAction();
scene.remove(charGroup);
```

### Quick Reference
| Method | When to use |
|--------|-------------|
| `loadSkinnedMesh(id)` | Once, to get the template mesh |
| `loadAnimationClip(id)` | Once, to get reusable clip data |
| `loadAnimation(group, id)` | Convenience — loads + plays in one call. Only use for one-off instances |
| `cloneSkinnedMesh()` + `new AnimationMixer` | Every subsequent instance — clone template, rebind skeleton, drive independently |

- **NEVER** call `loadSkinnedMesh()` per enemy/instance — it re-decodes the full mesh from the asset pack every time
- **NEVER** rely on `clone(true)` alone for skinned meshes — you will get T-posing clones that all share one skeleton

[Run.3DEngine Docs Index]|root:.rundot/3d-engine-docs|core:{Component.md,GameObject.md,VenusGame.md}|patterns:{ComponentCommunication.md,CreatingGameObjects.md,MeshColliders.md,MeshLoading.md}|physics:{Colliders.md,PhysicsSystem.md,RigidBodyComponent.md}|rendering:{AssetManager.md,InstancedRenderer.md,MeshRenderer.md,SkeletalRenderer.md}|systems:{AnimationSystem.md,AudioSystem.md,InputManager.md,LightingSystem.md,NavigationSystem.md,ParticleSystem.md,PrefabSystem.md,SplineSystem.md,StowKitSystem.md,TweenSystem.md,UISystem.md}