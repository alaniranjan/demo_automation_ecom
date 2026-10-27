import { get, head } from '@vercel/blob';
import { connection } from 'next/server';

// TEMPORARY: diagnose Blob reads on Vercel. Removed after debugging.
export async function GET() {
  await connection();
  const out: Record<string, unknown> = {
    hasToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    tokenPrefix: process.env.BLOB_READ_WRITE_TOKEN?.slice(0, 14),
    vercel: process.env.VERCEL,
  };
  try {
    const h = await head('data/framework.json');
    out.head = { size: h.size, url: h.url };
  } catch (error) {
    out.headError = String(error);
  }
  try {
    const result = await get('data/framework.json', { access: 'public', useCache: false });
    out.get = result ? { statusCode: result.statusCode } : null;
  } catch (error) {
    out.getError = String(error);
  }
  return Response.json(out);
}
