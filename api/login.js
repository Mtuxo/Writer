import { createHash, timingSafeEqual } from 'node:crypto';

function sameText(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function sessionToken(secret) {
  return createHash('sha256').update(`ethren-studio-v1:${secret}`).digest('hex');
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const expected = process.env.STUDIO_LOGIN_PASSWORD;
  if (!expected) return res.status(500).json({ error: 'STUDIO_LOGIN_PASSWORD is not configured in Vercel.' });

  const given = req.body?.password;
  if (typeof given !== 'string' || !sameText(given, expected)) {
    await sleep(700);
    return res.status(401).json({ error: 'Wrong password.' });
  }

  const token = sessionToken(expected);
  res.setHeader('Set-Cookie', `ethren_studio_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`);
  return res.status(200).json({ ok: true });
}
