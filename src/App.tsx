import { useRef, useState, useCallback } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { GameScene } from './GameScene';
import { WebGLUnavailableError } from './createWebGLRenderer';
import type { GameState } from './GameEvents';
import './style.css';

function App() {
  const gameRef = useRef<GameScene | null>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>('loading');
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const sceneRef = useCallback((container: HTMLDivElement | null) => {
    if (container && !gameRef.current) {
      try {
        const game = new GameScene(container);
        gameRef.current = game;
        game.events.on('stateChange', setGameState);
        game.events.on('scoreChange', setScore);
      } catch (err) {
        if (!(err instanceof WebGLUnavailableError)) throw err;
        // No WebGL at all — show a friendly fallback instead of crashing, and
        // dismiss the platform load screen so it doesn't hang forever.
        RundotGameAPI.error('[App] WebGL unavailable:', err);
        void RundotGameAPI.preloader.hideLoadScreen();
        setWebglUnavailable(true);
      }
    }
  }, []);

  const handleRestart = useCallback(() => {
    gameRef.current?.restart();
  }, []);

  if (webglUnavailable) {
    return (
      <div className="error-screen">
        <div className="error-icon">🎮</div>
        <h2 className="error-title">This game needs 3D graphics</h2>
        <p className="error-message">
          Enable hardware acceleration in your browser settings, or try another device or browser.
        </p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div ref={sceneRef} className="scene-container" />

      {gameState !== 'loading' && (
        <div className="hud">
          <div className="hud-score">{score}</div>

          {gameState === 'gameover' && (
            <div className="hud-gameover">
              <div className="hud-gameover-title">Game Over</div>
              <div className="hud-gameover-score">{score}</div>
              <button className="hud-gameover-btn" onClick={handleRestart}>
                Play Again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
