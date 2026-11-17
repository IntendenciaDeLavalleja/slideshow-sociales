import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = fileURLToPath(new URL('./dist/', import.meta.url));
const port = Number(process.argv[2] || 4173);
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(folder, `.${pathname === '/' ? '/index.html' : pathname}`);
    const relative = path.relative(folder, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Path outside the presentation');
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Path is not a file');
    response.writeHead(200, {
      'Content-Type': mime.get(path.extname(file)) || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Archivo no encontrado.');
  }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/`));
