import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { theme, applyTheme } from './theme';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('[Template React Simple] Root element not found');
}

const root = createRoot(rootElement);

const render = (node: ReactNode) => {
  root.render(<StrictMode>{node}</StrictMode>);
};

applyTheme(theme);

render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
