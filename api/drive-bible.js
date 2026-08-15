function validateMaster(master) {
  if (!master || typeof master !== 'object') throw new Error('The Story Bible payload is missing.');
  if (!master.bible || typeof master.bible !== 'object') throw new Error('The Story Bible payload has no bible object.');
  const sections = ['characters','vestiges','principles','dimensions','locations','nobility','timeline','relationships','mysteries','foreshadowing','knowledge','canonMemory'];
  for (const section of sections) {
    if (!Array.isArray(master.bible[section])) master.bible[section] = [];
  }
  const size = Buffer.byteLength(JSON.stringify(master), 'utf8');
  if (size > 1_500_000) throw new Error('The Story Bible is too large for this sync bridge.');
  return master;
}

async function callBridge(action, master) {
  const url = String(process.env.GOOGLE_BIBLE_BRIDGE_URL || '').trim();
  const secret = String(process.env.GOOGLE_BIBLE_BRIDGE_SECRET || '').trim();
  if (!url) throw new Error('GOOGLE_BIBLE_BRIDGE_URL is not configured in Vercel.');
  if (!secret) throw new Error('GOOGLE_BIBLE_BRIDGE_SECRET is not configured in Vercel.');
  if (!/^https:\/\/script\.google\.com\//i.test(url)) throw new Error('GOOGLE_BIBLE_BRIDGE_URL must be the deployed Google Apps Script web-app URL.');

  const payload = { action, secret };
  if (master) payload.master = master;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('Google Drive bridge returned an unreadable response. Redeploy the Apps Script web app and try again.'); }
  if (!response.ok || !data?.ok) throw new Error(data?.error || `Google Drive bridge failed (${response.status}).`);
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const result = await callBridge('get');
      return res.status(200).json(validateMaster(result.master));
    }
    if (req.method === 'POST') {
      const master = validateMaster(req.body?.master);
      master.updatedAt = new Date().toISOString();
      const result = await callBridge('put', master);
      return res.status(200).json({ ok: true, master: validateMaster(result.master || master) });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Google Drive Bible sync failed.' });
  }
}
