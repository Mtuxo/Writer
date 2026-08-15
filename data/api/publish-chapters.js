function cleanRepo(value) {
  const repo = String(value || 'Mtuxo/Writer').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error('GITHUB_REPO must look like owner/repo.');
  return repo;
}
function normalizeChapter(ch, index = 0) {
  const c = ch && typeof ch === 'object' ? ch : {};
  return {
    id: String(c.id || `ch-${index + 1}`),
    title: String(c.title || `Chapter ${index + 1}`),
    text: String(c.text || ''),
    meta: c.meta && typeof c.meta === 'object' ? c.meta : {}
  };
}
function decodeBase64Utf8(value) {
  return Buffer.from(String(value || '').replace(/\n/g, ''), 'base64').toString('utf8');
}
function encodeBase64Utf8(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_SYNC_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_SYNC_TOKEN is not configured in Vercel yet.' });

  let repo;
  try { repo = cleanRepo(process.env.GITHUB_REPO || 'Mtuxo/Writer'); }
  catch (err) { return res.status(500).json({ error: err.message }); }
  const branch = String(process.env.GITHUB_BRANCH || 'main').trim() || 'main';
  const filePath = 'data/chapters.json';
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'X-GitHub-Api-Version': '2026-03-10',
    'User-Agent': 'Ethren-Writing-Studio'
  };

  try {
    let existing = { schemaVersion: 1, updatedAt: '', source: 'Ethren Writing Studio master chapters', chapters: [] };
    let sha = '';

    const read = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
    if (read.ok) {
      const info = await read.json();
      sha = String(info.sha || '');
      try {
        const parsed = JSON.parse(decodeBase64Utf8(info.content));
        if (parsed && Array.isArray(parsed.chapters)) existing = parsed;
      } catch {}
    } else if (read.status !== 404) {
      const errBody = await read.json().catch(() => ({}));
      throw new Error(errBody.message || `GitHub read failed (${read.status}).`);
    }

    const mode = String(req.body?.mode || '');
    let chapters;
    if (mode === 'all') {
      if (!Array.isArray(req.body?.chapters) || !req.body.chapters.length) throw new Error('No chapters were provided.');
      chapters = req.body.chapters.map((ch, i) => normalizeChapter(ch, i));
    } else if (mode === 'current') {
      const incoming = normalizeChapter(req.body?.chapter, Number(req.body?.index) || 0);
      chapters = Array.isArray(existing.chapters) ? existing.chapters.map((ch, i) => normalizeChapter(ch, i)) : [];
      let at = chapters.findIndex(ch => ch.id && incoming.id && ch.id === incoming.id);
      if (at < 0) at = chapters.findIndex(ch => ch.title.trim().toLowerCase() === incoming.title.trim().toLowerCase());
      if (at < 0 && Number.isInteger(req.body?.index) && req.body.index >= 0 && req.body.index < chapters.length) at = req.body.index;
      if (at >= 0) chapters[at] = incoming;
      else chapters.push(incoming);
    } else {
      throw new Error('Unknown publish mode.');
    }

    const serializedSize = Buffer.byteLength(JSON.stringify(chapters), 'utf8');
    if (serializedSize > 4_500_000) throw new Error('The chapter master file is getting too large for this simple sync method. Export a backup and split the archive before publishing again.');

    const updatedAt = new Date().toISOString();
    const payload = {
      schemaVersion: 1,
      updatedAt,
      source: 'Ethren Writing Studio master chapters',
      chapters
    };
    const body = {
      message: mode === 'all' ? 'Publish all chapters from Writing Studio' : `Publish ${String(req.body?.chapter?.title || 'chapter')} from Writing Studio`,
      content: encodeBase64Utf8(JSON.stringify(payload, null, 2)),
      branch
    };
    if (sha) body.sha = sha;

    const write = await fetch(apiUrl, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await write.json().catch(() => ({}));
    if (!write.ok) throw new Error(result.message || `GitHub publish failed (${write.status}).`);

    return res.status(200).json({
      ok: true,
      updatedAt,
      count: chapters.length,
      commitSha: result.commit?.sha || '',
      path: filePath
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Chapter publish failed.' });
  }
}
