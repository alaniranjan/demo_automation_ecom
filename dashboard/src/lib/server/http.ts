import fs from 'node:fs/promises';
import path from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * Serves a file from disk with a content type derived from its extension; 404 when missing.
 * Honors a single `Range: bytes=a-b` request (206), which browsers need to seek within videos.
 */
export async function serveFile(
  filePath: string,
  request?: Request,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return new Response('Not found', { status: 404 });
    const headers = {
      'Content-Type': CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    };

    const range = request?.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/);
    if (range && (range[1] || range[2])) {
      const size = stat.size;
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start >= size || start > end) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      }
      const handle = await fs.open(filePath, 'r');
      try {
        const chunk = Buffer.alloc(end - start + 1);
        await handle.read(chunk, 0, chunk.length, start);
        return new Response(chunk, {
          status: 206,
          headers: {
            ...headers,
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': String(chunk.length),
          },
        });
      } finally {
        await handle.close();
      }
    }

    const body = await fs.readFile(filePath);
    return new Response(body, { headers: { ...headers, 'Content-Length': String(body.byteLength) } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

/**
 * Rejects cross-site requests to endpoints that start processes. Browsers send Origin on POST/DELETE,
 * so a page on another site cannot trigger runs on this local server.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
