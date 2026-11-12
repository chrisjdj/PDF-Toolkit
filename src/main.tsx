import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted font: no requests to third-party font CDNs (keeps the "no tracking" promise).
import '@fontsource-variable/inter';
import App from './App';
import './styles/index.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
