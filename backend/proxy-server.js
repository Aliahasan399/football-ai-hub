/**
 * Proxy Server — Port 3000
 *
 * Serves static files from the frontend dist/ directory (or public/)
 * AND proxies /api/* requests to the backend on port 4000.
 * This avoids CORS issues during development and production.
 */

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PROXY_PORT = process.env.PROXY_PORT || 3000;
const BACKEND_PORT = process.env.BACKEND_PORT || 4000;
const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';

// ──────────────────────────────────────────────
// Determine static directory
// ──────────────────────────────────────────────
const FRONTEND_DIR = path.resolve('/home/ali-ahasan/mybot_coder/football-ai-hub/frontend');
const STATIC_DIRS = [
  path.join(FRONTEND_DIR, 'dist'),
  path.join(FRONTEND_DIR, 'public')
];

let staticDir = null;
for (const dir of STATIC_DIRS) {
  if (fs.existsSync(dir)) {
    staticDir = dir;
    break;
  }
}

if (!staticDir) {
  console.warn('[Proxy] No static directory found. Trying to create one...');
  staticDir = STATIC_DIRS[0]; // default to dist
  try {
    fs.mkdirSync(staticDir, { recursive: true });
    fs.writeFileSync(path.join(staticDir, 'index.html'), '<!DOCTYPE html><html><head><title>Football AI Hub</title></head><body><h1>Football AI Hub</h1><p>Frontend build not yet available. Place your built frontend in frontend/dist/.</p></body></html>');
    console.log(`[Proxy] Created placeholder at ${staticDir}`);
  } catch (e) {
    console.error('[Proxy] Could not create static dir:', e.message);
  }
}

console.log(`[Proxy] Static files served from: ${staticDir}`);

// ──────────────────────────────────────────────
// Express app
// ──────────────────────────────────────────────
const app = express();

// Serve static files
app.use(express.static(staticDir));

// Proxy /api/* to backend
app.use('/api', (req, res) => {
  const options = {
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    path: '/api' + req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${BACKEND_HOST}:${BACKEND_PORT}`
    }
  };

  // Remove connection headers that might cause issues
  delete options.headers['connection'];

  const proxyReq = http.request(options, (proxyRes) => {
    // Forward status code and headers
    res.writeHead(proxyRes.statusCode, proxyRes.headers);

    // Pipe response data
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[Proxy] Error proxying to backend:', err.message);
    res.status(502).json({
      error: 'Bad Gateway',
      message: `Could not connect to backend at ${BACKEND_HOST}:${BACKEND_PORT}`
    });
  });

  // Pipe request body to backend
  req.pipe(proxyReq);
});

// Fallback: serve index.html for SPA routing (if using client-side router)
app.get('*', (req, res) => {
  const indexPath = path.join(staticDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// ──────────────────────────────────────────────
// Start proxy
// ──────────────────────────────────────────────
app.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`[Proxy] Frontend proxy running on http://localhost:${PROXY_PORT}`);
  console.log(`[Proxy] Proxying /api/* → http://${BACKEND_HOST}:${BACKEND_PORT}`);
  console.log(`[Proxy] Serving static files from: ${staticDir}`);
});
