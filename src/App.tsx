import { useRef, useEffect } from 'react';
import { GameScene } from './GameScene';
import './style.css';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const game = new GameScene(containerRef.current);
    return () => game.dispose();
  }, []);

  return (
    <div className="app-container">
      <div ref={containerRef} className="scene-container" />
    </div>
  );
}

export default App;
