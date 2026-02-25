import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Mesh } from 'three';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

const DIE_FACE_COLOR = '#4a56a8';
const FACE_SIZE = 256;
const DOT_SIZE = 48;

const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.73, 0.27], [0.27, 0.73]],
  3: [[0.73, 0.27], [0.5, 0.5], [0.27, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.23], [0.27, 0.5], [0.27, 0.77], [0.73, 0.23], [0.73, 0.5], [0.73, 0.77]],
};

function buildFaceTexture(dotImage: HTMLImageElement, pips: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = FACE_SIZE;
  canvas.height = FACE_SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = DIE_FACE_COLOR;
  ctx.fillRect(0, 0, FACE_SIZE, FACE_SIZE);

  const half = DOT_SIZE / 2;
  for (const [px, py] of DOT_POSITIONS[pips]) {
    ctx.drawImage(dotImage, px * FACE_SIZE - half, py * FACE_SIZE - half, DOT_SIZE, DOT_SIZE);
  }

  return new THREE.CanvasTexture(canvas);
}

function RotatingDie({ materials }: { materials: THREE.MeshStandardMaterial[] | null }) {
  const meshRef = useRef<Mesh>(null);

  useEffect(() => {
    if (!meshRef.current || !materials) return;
    meshRef.current.material = materials;
  }, [materials]);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.5;
    meshRef.current.rotation.y += delta * 0.7;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color={DIE_FACE_COLOR} />
    </mesh>
  );
}

export const SceneTab: React.FC = () => {
  const [materials, setMaterials] = useState<THREE.MeshStandardMaterial[] | null>(null);

  useEffect(() => {
    let disposed = false;

    RundotGameAPI.cdn
      .fetchAsset('circle.png')
      .then((blob) => {
        if (disposed) return;
        const img = new Image();
        img.onload = () => {
          if (disposed) return;

          const faceOrder = [1, 6, 2, 5, 3, 4];
          const mats = faceOrder.map((pips) => {
            const tex = buildFaceTexture(img, pips);
            return new THREE.MeshStandardMaterial({ map: tex });
          });

          setMaterials(mats);
        };
        img.src = URL.createObjectURL(blob);
      })
      .catch((err) => {
        RundotGameAPI.error('[SceneTab] Error fetching CDN asset:', err);
      });

    return () => {
      disposed = true;
    };
  }, []);

  return (
    <div className="scene-container">
      <Canvas camera={{ position: [3, 2, 3], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <RotatingDie materials={materials} />
        <OrbitControls enablePan={false} />
        <gridHelper args={[10, 10, '#333333', '#222222']} />
      </Canvas>
    </div>
  );
};
