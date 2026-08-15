import { next } from '@vercel/functions';

function getCookie(header, name) {
  const parts = String(header || '').split(';');
  for (const part of parts) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}
async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/login.html' || path === '/api/login' || path === '/favicon.ico') return next();

  const secret = process.env.STUDIO_LOGIN_PASSWORD;
  const current = getCookie(request.headers.get('cookie'), 'ethren_studio_session');
  const expected = secret ? await sha256Hex(`ethren-studio-v1:${secret}`) : '';
  const authed = Boolean(secret && current && current === expected);

  if (!authed) {
    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Authentication required.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    }
    const dest = new URL('/login.html', request.url);
    dest.searchParams.set('next', path + url.search);
    return Response.redirect(dest, 307);
  }

  return next();
}

export const config = {
  matcher: '/((?!_vercel/).*)'
};
