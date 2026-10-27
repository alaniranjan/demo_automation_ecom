import fs from 'node:fs/promises';
import path from 'node:path';
import { connection, type NextRequest } from 'next/server';
import { serveFile } from '@/lib/server/http';
import { VISUAL_BASELINE_DIR, resolveInside } from '@/lib/server/paths';

export interface BaselineFile {
  name: string;
  kind: 'screenshot' | 'structure';
  size: number;
  updatedAt: string;
}

/**
 * Approved UI baselines in the framework's visual-baselines/ folder.
 * Without parameters: the list. With `?name=header.png`: that file (images and .aria.yml only).
 */
export async function GET(request: NextRequest) {
  await connection();
  const name = request.nextUrl.searchParams.get('name');
  if (name) {
    const file = /\.(png|aria\.yml)$/.test(name) ? resolveInside(VISUAL_BASELINE_DIR, name) : null;
    if (!file) return new Response('Not found', { status: 404 });
    return serveFile(file, request);
  }

  const entries = await fs.readdir(VISUAL_BASELINE_DIR).catch(() => [] as string[]);
  const files: BaselineFile[] = [];
  for (const entry of entries.filter((item) => /\.(png|aria\.yml)$/.test(item)).sort()) {
    const stat = await fs.stat(path.join(VISUAL_BASELINE_DIR, entry));
    files.push({
      name: entry,
      kind: entry.endsWith('.png') ? 'screenshot' : 'structure',
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  }
  return Response.json({ files }, { headers: { 'Cache-Control': 'no-store' } });
}
