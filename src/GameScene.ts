import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { loadStowKitPack, disposeStowKitPack } from './loadStowKitPack';

export class GameScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private animationFrameId = 0;
  private resizeObserver: ResizeObserver;
  private diceContainer: THREE.Group | null = null;
  private envMap: THREE.Texture | null = null;

  constructor(container: HTMLDivElement) {
    const { clientWidth: w, clientHeight: h } = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: true,
    });

    // Manual DPR handling — don't use setPixelRatio (breaks post-processing, GPU picking, gl_FragCoord)
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.renderer.setSize(w * dpr, h * dpr, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;

    // Tone mapping
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.5;

    // Shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 1, 500);
    this.camera.position.set(3, 2, 3);

    this.scene = new THREE.Scene();

    // Sky + environment map for IBL lighting
    const sunPosition = new THREE.Vector3(5, 8, 5);
    this.setupSky(sunPosition);

    // Ambient fill (reduced — environment map provides indirect light now)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    // Directional light — position matches sun so shadows align with sky
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.copy(sunPosition);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 20;
    dirLight.shadow.camera.left = -5;
    dirLight.shadow.camera.right = 5;
    dirLight.shadow.camera.top = 5;
    dirLight.shadow.camera.bottom = -5;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    this.scene.add(dirLight);
    this.scene.add(dirLight.target); // Required — Three.js needs the target in the scene graph

    // Ground plane that receives shadows
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.ShadowMaterial({ opacity: 0.3 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    ground.receiveShadow = true;
    this.scene.add(ground);


    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;

    // ResizeObserver — better than window resize (element-level, fires between layout and paint)
    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(container);

    this.start();
    this.loadAssets();
  }

  private setupSky(sunPosition: THREE.Vector3) {
    const sky = new Sky();
    sky.scale.setScalar(450);

    const uniforms = sky.material.uniforms;
    uniforms['turbidity']!.value = 2;
    uniforms['rayleigh']!.value = 1;
    uniforms['mieCoefficient']!.value = 0.005;
    uniforms['mieDirectionalG']!.value = 0.8;
    uniforms['sunPosition']!.value.copy(sunPosition.clone().normalize());

    this.scene.add(sky);

    // Generate PMREM environment map from the sky for IBL (image-based lighting)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileCubemapShader();
    const envScene = new THREE.Scene();
    envScene.add(sky.clone());
    // Use fromScene to capture the sky into a cubemap
    const envRT = pmrem.fromScene(envScene, 0, 0.1, 100);
    this.envMap = envRT.texture;
    this.scene.environment = this.envMap;
    this.scene.background = this.envMap;
    pmrem.dispose();
  }

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

  private async loadAssets() {
    try {
      const pack = await loadStowKitPack('default');
      const mesh = await pack.loadMesh('sm_dice');

      // castShadow/receiveShadow don't propagate — traverse to enable on all child meshes
      mesh.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });

      this.diceContainer = new THREE.Group();
      this.diceContainer.add(mesh);
      this.scene.add(this.diceContainer);
    } catch (err) {
      RundotGameAPI.error('[GameScene] Error loading assets:', err);
    }
  }

  private update = () => {
    this.animationFrameId = requestAnimationFrame(this.update);
    const delta = this.clock.getDelta();

    if (this.diceContainer) {
      this.diceContainer.rotation.x += delta * 0.5;
      this.diceContainer.rotation.y += delta * 0.7;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  start() {
    this.clock.start();
    this.update();
  }

  dispose() {
    cancelAnimationFrame(this.animationFrameId);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.envMap?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    disposeStowKitPack('default');
  }
}
