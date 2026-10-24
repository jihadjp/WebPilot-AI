import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createApiRouter } from './src/server/apiRouter';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Enforce strict JSON payload size limit (100KB max to prevent oversized payload DoS)
  app.use(express.json({ limit: '100kb' }));

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Mount API v1 routes
  app.use('/api/v1', createApiRouter());

  // Handle oversized body or malformed JSON errors cleanly
  app.use(
    (
      err: { status?: number; type?: string; message?: string },
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err && (err.type === 'entity.too.large' || err.status === 413)) {
        res.status(413).json({
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Request payload exceeds the 100KB maximum security limit.',
          },
        });
        return;
      }
      if (err instanceof SyntaxError) {
        res.status(400).json({
          error: {
            code: 'INVALID_JSON',
            message: 'Malformed JSON body.',
          },
        });
        return;
      }
      next(err);
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WebPilot AI full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
