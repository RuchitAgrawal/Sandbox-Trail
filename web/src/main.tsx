import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initWasm } from './engine/wasmBridge';

async function bootstrap() {
  // Initialize WASM Simulation Controller (5 nodes, default seed 42)
  await initWasm(5, 42);

  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}

bootstrap();
