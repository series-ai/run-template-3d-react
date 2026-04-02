import { useRef, useState, useCallback } from 'react';
import { GameScene } from './GameScene';
import type { GameState } from './GameEvents';
import './style.css';

function App() {
  const gameRef = useRef<GameScene | null>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>('loading');

  const sceneRef = useCallback((container: HTMLDivElement | null) => {
    if (container && !gameRef.current) {
      const game = new GameScene(container);
      gameRef.current = game;
      game.events.on('stateChange', setGameState);
      game.events.on('scoreChange', setScore);
    } else if (!container && gameRef.current) {
      gameRef.current.dispose();
      gameRef.current = null;
    }
  }, []);

  const handleRestart = useCallback(() => {
    gameRef.current?.restart();
  }, []);

  return (
    <div className="app-container">
      <div ref={sceneRef} className="scene-container" />

      {gameState !== 'loading' && (
        <div className="hud">
          {gameState === 'ready' && (
            <div className="hud-tap-prompt">
              <div className="hud-title">FLAPPY CLANKER</div>
              <div className="hud-subtitle">TAP TO START</div>
            </div>
          )}

          {gameState === 'playing' && (
            <div className="hud-score">{score}</div>
          )}

          {gameState === 'gameover' && (
            <div className="hud-gameover">
              <div className="hud-gameover-title">WRECKED</div>
              <div className="hud-gameover-score">{score}</div>
              <div className="hud-gameover-label">SCORE</div>
              <button className="hud-gameover-btn" onClick={handleRestart}>
                TRY AGAIN
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
