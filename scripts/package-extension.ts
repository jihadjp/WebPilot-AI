import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';

async function packageExtension() {
  const outDir = path.resolve(process.cwd(), 'dist-extension');
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = {
    manifest_version: 3,
    name: 'WebPilot AI — Understand the web. Take smarter action.',
    short_name: 'WebPilot AI',
    version: '1.0.0',
    description:
      'Source-grounded AI summaries, contextual Q&A, selected-text explanations, and study quizzes for Chrome & Edge.',
    permissions: ['activeTab', 'scripting', 'storage', 'sidePanel'],
    background: {
      service_worker: 'background.js',
      type: 'module',
    },
    side_panel: {
      default_path: 'index.html',
    },
    action: {
      default_title: 'Open WebPilot AI Side Panel',
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
  };

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  await esbuild.build({
    entryPoints: ['apps/extension/entrypoints/background.ts'],
    bundle: true,
    outfile: path.join(outDir, 'background.js'),
    format: 'esm',
    platform: 'browser',
    target: ['chrome114', 'edge114'],
  });

  await esbuild.build({
    entryPoints: ['apps/extension/entrypoints/content.ts'],
    bundle: true,
    outfile: path.join(outDir, 'content.js'),
    format: 'iife',
    platform: 'browser',
    target: ['chrome114', 'edge114'],
  });

  // Copy compiled frontend assets if dist/ exists
  const webDist = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(webDist)) {
    fs.cpSync(webDist, outDir, { recursive: true });
  }

  console.log('Packaged Manifest V3 extension into dist-extension/');
}

packageExtension().catch((err) => {
  console.error(err);
  process.exit(1);
});
