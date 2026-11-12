import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted fonts: no requests to third-party font CDNs (keeps the "no tracking" promise).
import '@fontsource-variable/inter';
import '@fontsource-variable/outfit';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
