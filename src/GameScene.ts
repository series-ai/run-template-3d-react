import * as THREE from 'three';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { loadStowKitPack, disposeStowKitPack } from './loadStowKitPack';
import type { StowKitPack } from '@series-inc/stowkit-three-loader';
import { GameEventEmitter, type GameState } from './GameEvents';

const GRAVITY = -25;
const FLAP_VELOCITY = 9;
const MAX_FALL_SPEED = -15;
const SCROLL_SPEED = 5;
const PIPE_SPACING = 10;
const GAP_SIZE = 10;
const GAP_Y_MIN = -4;
const GAP_Y_MAX = 5;
const BIRD_X = 0;
const CEILING_Y = 12;
const FLOOR_Y = -12;
const BIRD_RADIUS = 1;
const PIPE_HALF_WIDTH = 2;
const MAX_TILT_UP = Math.PI / 5;
const MAX_TILT_DOWN = -Math.PI / 2.5;
const TILT_SPEED = 6;
const SAW_SPIN_SPEED = 3;
const SHAKE_DURATION = 0.3;

interface Pipe {
  group: THREE.Group;
  topSaw: THREE.Object3D | null;
  bottomSaw: THREE.Object3D | null;
  x: number;
  gapY: number;
  scored: boolean;
}

function enableReceiveShadow(obj: THREE.Object3D): void {
  obj.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) c.receiveShadow = true;
  });
}

export class GameScene {
  readonly events = new GameEventEmitter();

  private state: GameState = 'loading';
  private score = 0;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private animationFrameId = 0;
  private resizeObserver: ResizeObserver;

  private listener: THREE.AudioListener;
  private coinSfx: THREE.Audio | null = null;

  private bird: THREE.Group | null = null;
  private birdKey: THREE.Object3D | null = null;
  private velocityY = 0;
  private birdY = 0;

  private pipes: Pipe[] = [];
  private pack: StowKitPack | null = null;
  private elapsedTime = 0;
  private boundFlap: () => void;
  private distanceTravelled = 0;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private cameraBasePos = new THREE.Vector3();
  private freezeTimer = 0;

  constructor(container: HTMLDivElement) {
    const { clientWidth: w, clientHeight: h } = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: true,
    });

    const dpr = Math.min(window.devicePixelRatio, 2);
    this.renderer.setSize(w * dpr, h * dpr, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 300);
    this.camera.position.set(BIRD_X, 0, -32);
    this.camera.lookAt(BIRD_X, 0, 0);
    this.cameraBasePos.copy(this.camera.position);

    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 30, 120);

    this.scene.add(new THREE.HemisphereLight(0x87CEEB, 0x556B2F, 1.0));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(3, 8, -10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 60;
    dirLight.shadow.camera.left = -25;
    dirLight.shadow.camera.right = 25;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    this.scene.add(dirLight);
    this.scene.add(dirLight.target);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(container);

    this.boundFlap = this.flap.bind(this);
    this.renderer.domElement.addEventListener('pointerdown', this.boundFlap);

    this.start();
    this.loadAssets();
  }

  // ---------------------------------------------------------------------------
  // State machine
  // ---------------------------------------------------------------------------

  getState(): GameState {
    return this.state;
  }

  getScore(): number {
    return this.score;
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.setState('paused');
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.setState('playing');
  }

  gameOver(): void {
    if (this.state !== 'playing') return;
    this.shakeCamera(0.15, SHAKE_DURATION);
    this.freezeTimer = 0.4;
    this.setState('gameover');
  }

  restart(): void {
    this.score = 0;
    this.events.emit('scoreChange', this.score);

    for (const pipe of this.pipes) {
      this.scene.remove(pipe.group);
    }
    this.pipes = [];

    this.birdY = 0;
    this.velocityY = 0;
    this.distanceTravelled = 0;
    if (this.bird) {
      this.bird.position.y = this.birdY;
      this.bird.rotation.z = 0;
      this.bird.scale.set(1, 1, 1);
    }

    this.freezeTimer = 0;
    this.shakeTimer = 0;
    this.camera.position.copy(this.cameraBasePos);

    this.setState('ready');
  }

  startPlaying(): void {
    if (this.state !== 'ready') return;
    this.birdY = 0;
    this.velocityY = FLAP_VELOCITY;
    this.setState('playing');
  }

  private setState(next: GameState): void {
    this.state = next;
    this.events.emit('stateChange', next);
  }

  setScore(value: number): void {
    this.score = value;
    this.events.emit('scoreChange', value);
  }

  addScore(delta: number): void {
    this.setScore(this.score + delta);
    if (this.coinSfx) {
      if (this.coinSfx.isPlaying) this.coinSfx.stop();
      this.coinSfx.play();
    }
  }

  private flap(): void {
    if (this.state === 'ready') {
      this.startPlaying();
      return;
    }
    if (this.state !== 'playing') return;
    this.velocityY = FLAP_VELOCITY;
  }

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------

  private onResize = (entries: ResizeObserverEntry[]) => {
    const entry = entries[0];
    if (!entry) return;
    const { width: w, height: h } = entry.contentRect;
    if (w === 0 || h === 0) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    this.renderer.setSize(w * dpr, h * dpr, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  // ---------------------------------------------------------------------------
  // Asset loading
  // ---------------------------------------------------------------------------

  private async loadAssets() {
    try {
      this.pack = await loadStowKitPack('default');

      const botMesh = await this.pack.loadMesh('bot');
      enableReceiveShadow(botMesh);

      this.bird = new THREE.Group();
      // Side profile facing screen-right (-X), angled slightly toward camera
      botMesh.rotation.y = -Math.PI / 2 - Math.PI / 12;
      this.bird.add(botMesh);
      this.bird.position.set(BIRD_X, 0, 0);
      this.birdY = 0;
      this.scene.add(this.bird);

      botMesh.traverse((c) => {
        if (c.name === 'Key') this.birdKey = c;
      });

      this.coinSfx = await this.pack.loadAudio('audio/digital-audio/powerup2', this.listener);
      if (this.coinSfx.isPlaying) this.coinSfx.stop();
      this.coinSfx.setVolume(1);

      this.setState('ready');
    } catch (err) {
      RundotGameAPI.error('[GameScene] Error loading assets:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Pipe spawning
  // ---------------------------------------------------------------------------

  private async spawnPipe(): Promise<void> {
    if (!this.pack) return;

    const gapY = GAP_Y_MIN + Math.random() * (GAP_Y_MAX - GAP_Y_MIN);
    const spawnX = BIRD_X - 18;

    const [bottomArm, topArm] = await Promise.all([
      this.pack.loadMesh('arm'),
      this.pack.loadMesh('arm'),
    ]);
    enableReceiveShadow(bottomArm);
    enableReceiveShadow(topArm);

    const group = new THREE.Group();
    group.position.set(spawnX, 0, 0);
    group.rotation.y = Math.PI / 2;

    // Bottom: flip so blade (origin) is at gap edge, arm hangs down
    bottomArm.rotation.x = Math.PI;
    bottomArm.position.y = gapY - GAP_SIZE / 2;
    group.add(bottomArm);

    // Top: natural orientation — blade at origin (gap edge), arm goes up
    topArm.position.y = gapY + GAP_SIZE / 2;
    group.add(topArm);

    let topSaw: THREE.Object3D | null = null;
    let bottomSaw: THREE.Object3D | null = null;
    topArm.traverse((c) => { if (c.name === 'Saw') topSaw = c; });
    bottomArm.traverse((c) => { if (c.name === 'Saw') bottomSaw = c; });

    this.scene.add(group);
    this.pipes.push({ group, topSaw, bottomSaw, x: spawnX, gapY, scored: false });
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  private applyBirdGravity(delta: number): void {
    this.velocityY += GRAVITY * delta;
    this.birdY += this.velocityY * delta;
    if (this.birdY <= FLOOR_Y + BIRD_RADIUS) {
      this.birdY = FLOOR_Y + BIRD_RADIUS;
    }
    if (this.bird) this.bird.position.y = this.birdY;
  }

  private spinSaws(delta: number): void {
    for (const pipe of this.pipes) {
      if (pipe.topSaw) pipe.topSaw.rotation.x += delta * SAW_SPIN_SPEED;
      if (pipe.bottomSaw) pipe.bottomSaw.rotation.x += delta * SAW_SPIN_SPEED;
    }
  }

  // ---------------------------------------------------------------------------
  // Collision detection
  // ---------------------------------------------------------------------------

  private checkCollision(): boolean {
    for (const pipe of this.pipes) {
      if (BIRD_X + BIRD_RADIUS > pipe.x - PIPE_HALF_WIDTH &&
          BIRD_X - BIRD_RADIUS < pipe.x + PIPE_HALF_WIDTH) {
        const halfGap = GAP_SIZE / 2;
        if (this.birdY - BIRD_RADIUS < pipe.gapY - halfGap ||
            this.birdY + BIRD_RADIUS > pipe.gapY + halfGap) {
          return true;
        }
      }
    }
    return false;
  }

  private shakeCamera(intensity: number, duration: number): void {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  // ---------------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------------

  private update = () => {
    this.animationFrameId = requestAnimationFrame(this.update);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.elapsedTime += delta;

    switch (this.state) {
      case 'loading': break;
      case 'ready': this.updateReady(delta); break;
      case 'playing': this.updatePlaying(delta); break;
      case 'paused': break;
      case 'gameover': this.updateGameOver(delta); break;
    }

    this.camera.position.copy(this.cameraBasePos);
    if (this.shakeTimer > 0) {
      this.shakeTimer -= delta;
      const t = Math.max(0, this.shakeTimer / SHAKE_DURATION);
      const shake = this.shakeIntensity * t;
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updateReady(delta: number): void {
    if (this.bird) {
      this.bird.position.y = Math.sin(this.elapsedTime * 3) * 0.3;
      this.bird.rotation.z = 0;
    }
    if (this.birdKey) {
      this.birdKey.rotation.z += delta * 3;
    }
  }

  private updatePlaying(delta: number): void {
    this.velocityY += GRAVITY * delta;
    if (this.velocityY < MAX_FALL_SPEED) this.velocityY = MAX_FALL_SPEED;
    this.birdY += this.velocityY * delta;

    if (this.birdY - BIRD_RADIUS <= FLOOR_Y) {
      this.birdY = FLOOR_Y + BIRD_RADIUS;
      this.gameOver();
      return;
    }
    if (this.birdY + BIRD_RADIUS >= CEILING_Y) {
      this.birdY = CEILING_Y - BIRD_RADIUS;
      this.velocityY = 0;
    }

    if (this.bird) {
      this.bird.position.y = this.birdY;

      const targetTilt = this.velocityY > 0
        ? THREE.MathUtils.mapLinear(this.velocityY, 0, FLAP_VELOCITY, 0, MAX_TILT_UP)
        : THREE.MathUtils.mapLinear(this.velocityY, MAX_FALL_SPEED, 0, MAX_TILT_DOWN, 0);
      this.bird.rotation.z = THREE.MathUtils.lerp(
        this.bird.rotation.z, targetTilt, TILT_SPEED * delta,
      );
    }

    if (this.birdKey) {
      this.birdKey.rotation.z += delta * (this.velocityY > 2 ? 15 : 4);
    }

    const scrollDist = SCROLL_SPEED * delta;
    this.distanceTravelled += scrollDist;
    if (this.distanceTravelled >= PIPE_SPACING) {
      this.distanceTravelled -= PIPE_SPACING;
      this.spawnPipe().catch((err) =>
        RundotGameAPI.error('[GameScene] Pipe spawn error:', err),
      );
    }

    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const pipe = this.pipes[i]!;
      pipe.x += scrollDist;
      pipe.group.position.x = pipe.x;

      if (!pipe.scored && pipe.x > BIRD_X) {
        pipe.scored = true;
        this.addScore(1);
      }

      if (pipe.x > BIRD_X + 25) {
        this.scene.remove(pipe.group);
        this.pipes.splice(i, 1);
      }
    }

    this.spinSaws(delta);

    if (this.checkCollision()) {
      this.gameOver();
    }
  }

  private updateGameOver(delta: number): void {
    if (this.freezeTimer > 0) {
      this.freezeTimer -= delta;
      return;
    }

    if (this.bird && this.birdY > FLOOR_Y + BIRD_RADIUS) {
      this.applyBirdGravity(delta);
      this.bird.rotation.z = THREE.MathUtils.lerp(
        this.bird.rotation.z, MAX_TILT_DOWN, TILT_SPEED * delta,
      );
    }

    this.spinSaws(delta);
  }

  private start() {
    this.clock.start();
    this.update();
  }

  dispose() {
    cancelAnimationFrame(this.animationFrameId);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.boundFlap);
    for (const pipe of this.pipes) {
      this.scene.remove(pipe.group);
    }
    this.pipes = [];
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.events.removeAll();
    disposeStowKitPack('default');
  }
}
