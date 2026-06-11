import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { flushPersist } from './state/store';
import './styles.css';

// A deploy can replace the hashed chunks (force-pushed gh-pages + autoUpdate
// service worker) while a session is open; a lazy import of Excel/Word then
// 404s. Reload onto the new build — state is persisted, nothing is lost.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  const KEY = 'agile-pricer-preload-reload';
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last < 30_000) return; // don't reload-loop
  sessionStorage.setItem(KEY, String(Date.now()));
  flushPersist();
  location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
