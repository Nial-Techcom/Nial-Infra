import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './index.css';
import { App } from './App';
import { initPlatform } from './lib/platform';

// On desktop the server URL lives in the Electron shell, so it must be known before the first API call.
void initPlatform().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
