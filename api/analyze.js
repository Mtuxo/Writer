function extractOutputText(data) {
  return data.output_text || (data.output || [])
    .flatMap(item => item.content || [])
    .filter(c => c.type === 'output_text')
    .map(c => c.text)
    .join('');
}

function parseJson(text) {
  try { return JSON.parse(text); }
  catch {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) throw new Error('The AI response was not valid JSON.');
    return JSON.parse(match[0]);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });

  const { mode = 'continuity', title = 'Untitled', text = '', sceneCard = '', memory = '' } = req.body || {};
  if (!String(text).trim()) return res.status(400).json({ error: 'No chapter text was provided.' });

  const safeText = String(text).slice(0, 52000);
  const safeMemory = String(memory).slice(0, 36000);
  const safeScene = String(sceneCard).slice(0, 3000);

  const shared = `
You are the story-intelligence assistant inside a private fantasy web-novel writing studio.
Use ONLY the supplied chapter, scene card, and world-bible memory as story canon. If the memory marks something as planned, earlier, working, TBD, or uncertain, preserve that uncertainty. Never silently promote an idea into canon.

Writer style to preserve:
- direct, readable web-novel prose
- relatively short paragraphs
- simple clarity over ornate prose
- effective dramatic fragments can remain
- occasional tiny POV shifts can be intentional
- advice first; do not rewrite the whole chapter
- do not imitate another author or novel

Pay special attention to name spellings, character knowledge, relationships, powers, revealed-vs-secret information, chronology, and what the reader has actually been told.`;

  let task = '';
  let shape = '';
  if (mode === 'brainstorm') {
    task = `Give 3-5 possible next STORY DIRECTIONS. Do not write finished prose. Each direction should respect the scene card, character arcs, unresolved mysteries, pacing, and the author's existing plans. Favor options that create choices rather than forcing one answer.`;
    shape = `{"summary":"brief guidance","directions":[{"title":"short option title","beat":"what happens next in 2-4 sentences","why":"why it fits","risk":"what could make this option weaker"}]}`;
  } else if (mode === 'power') {
    task = `Check the chapter for contradictions or unclear logic involving Vestiges/Tablets, Principles, ranks, Manifestations, Dimensions, Heralds, abilities, costs, limits, or previously established power facts. Do not flag a mystery merely because it is unexplained if the draft intentionally withholds it.`;
    shape = `{"summary":"brief overall assessment","issues":[{"severity":"High|Medium|Low","category":"Power rule|Ability|Rank|Principle|Vestige|Dimension|Terminology","quote":"short exact quote","issue":"what may contradict or confuse","suggestion":"specific fix or question to resolve"}]}`;
  } else if (mode === 'confusion') {
    task = `Read like a new web-novel reader. Find places where a reader may genuinely become confused about who is speaking/acting, where the scene is, what caused an action, what a power did, what a name refers to, or why a transition happened. Do not punish deliberate mystery or effective short fragments.`;
    shape = `{"summary":"brief reader-experience assessment","issues":[{"severity":"High|Medium|Low","category":"Speaker|Action|Location|Transition|Power|Name|Motivation|POV","quote":"short exact quote","issue":"what a reader may misunderstand","suggestion":"smallest useful clarification"}]}`;
  } else if (mode === 'canon') {
    task = `Extract only NEW, explicit, chapter-supported canon facts that may be worth remembering later: appearances, relationships, revealed powers, names/titles, locations, promises, injuries, objects, knowledge gained, mysteries introduced or paid off. Do NOT infer hidden motives. Do NOT extract facts already clearly present in the supplied memory unless this chapter changes them. Quote a tiny source phrase for each fact.`;
    shape = `{"summary":"brief note","facts":[{"category":"Character|Power|Relationship|Location|Timeline|Knowledge|Mystery|Foreshadowing|Object|Other","fact":"one concise canon fact","confidence":"Explicit|Strongly implied","source":"very short source quote"}]}`;
  } else {
    task = `Run a continuity check. Look for name/spelling drift, changed appearance, impossible knowledge, relationship inconsistencies, timeline contradictions, location continuity, power contradictions, and planned-vs-revealed canon mistakes. A planned future event is NOT a contradiction just because it has not happened yet.`;
    shape = `{"summary":"brief continuity assessment","issues":[{"severity":"High|Medium|Low","category":"Name|Appearance|Knowledge|Relationship|Timeline|Location|Power|Canon status","quote":"short exact quote","issue":"what may be inconsistent","suggestion":"how to fix or what to verify"}]}`;
  }

  const instructions = `${shared}\n\nTASK:\n${task}\n\nReturn ONLY valid JSON matching this structure:\n${shape}`;
  const input = `TITLE: ${String(title).slice(0, 300)}\n\nSCENE CARD:\n${safeScene || '[not set]'}\n\nWORLD BIBLE / CANON MEMORY:\n${safeMemory || '[none]'}\n\nCURRENT CHAPTER:\n${safeText}`;

  const model = process.env.OPENAI_ANALYZE_MODEL || 'gpt-5.6-terra';
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: mode === 'brainstorm' ? 'medium' : 'low' },
        instructions,
        input,
        max_output_tokens: mode === 'brainstorm' ? 1800 : 2200,
        store: false
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'OpenAI request failed.' });
    const parsed = parseJson(extractOutputText(data));
    return res.status(200).json({ ...parsed, model, usage: data.usage || null });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'The story analysis service could not be reached.' });
  }
}
