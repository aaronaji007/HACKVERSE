import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { ReactLenis } from 'lenis/react';
import { Analytics } from '@vercel/analytics/react';

function RootComponent() {
  return (
    <ReactLenis root options={{ lerp: 0.08, smoothWheel: true }}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <Analytics />
    </ReactLenis>
  );
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<RootComponent />);
