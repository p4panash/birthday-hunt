import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { primeClientId } from './lib/clientId';
import './styles/tokens.css';
import './styles/globals.css';

// Hydrate the cached client_id from native preferences (no-op on web) before
// the first render that might call getClientId() synchronously. Awaiting
// this is intentional — it's ~1ms and prevents a race on native cold start.
void primeClientId();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
