import { useState, useEffect, useRef } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { HapticFeedbackStyle } from '@series-inc/rundot-game-sdk';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

export const HomeTab: React.FC = () => {
  const [counter, setCounter] = useState<number>(0);
  const hasLoadedRef = useRef(false);

  // Load saved counter on mount (once only, even in StrictMode)
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadCounter = async () => {
      try {
        const saved = await RundotGameAPI.appStorage.getItem('counter');
        if (saved !== null) {
          setCounter(parseInt(saved, 10));
        }
      } catch (error) {
        RundotGameAPI.error('[HomeTab] Error loading counter:', error);
      }
    };

    loadCounter();
  }, []);

  // Auto-save whenever counter changes (skip the initial load)
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    RundotGameAPI.appStorage.setItem('counter', counter.toString());
  }, [counter]);

  const updateCounter = async (delta: number) => {
    await RundotGameAPI.triggerHapticAsync(HapticFeedbackStyle.Light);
    setCounter((prev) => prev + delta);
  };

  return (
    <>
      <Card title="Welcome">
        <p>
          This is a simple React template for RUN.game projects. It includes theming, tab
          navigation, appStorage, and ad integration out of the box.
        </p>
      </Card>

      <Card
        title="Counter with Storage"
        description="Demonstrates state management, haptic feedback, and persistent storage via RundotGameAPI"
      >
        <div className="counter-display">{counter}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <Button variant="primary" onClick={() => updateCounter(-1)}>
            −
          </Button>
          <Button variant="primary" onClick={() => updateCounter(1)}>
            +
          </Button>
        </div>
      </Card>
    </>
  );
};
