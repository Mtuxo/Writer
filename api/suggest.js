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

  const {
    title = 'Untitled', mode = 'natural', strength = 'balanced', paragraph = '',
    before = '', after = '', storyBible = '', sceneGoal = '', source = 'live'
  } = req.body || {};
  if (!String(paragraph).trim()) return res.status(400).json({ error: 'No passage was provided.' });

  const safeParagraph = String(paragraph).slice(0, 7000);
  const safeBefore = String(before).slice(-1800);
  const safeAfter = String(after).slice(0, 1800);
  const safeBible = String(storyBible).slice(0, 14000);
  const safeGoal = String(sceneGoal).slice(0, 1600);

  const modeGuide = {
    natural: 'Make the passage sound more natural without making it more literary.',
    flow: 'Smooth sentence-to-sentence movement and remove awkward stops or repetition.',
    description: 'Improve description with one or two concrete details; avoid purple prose.',
    dialogue: 'Make dialogue and nearby reactions sound believable for the characters.',
    tension: 'Increase tension using pacing, reaction, sentence rhythm, or withheld information.',
    reaction: 'Strengthen the character reaction so it feels specific and earned, not melodramatic.',
    transition: 'Improve the transition into, through, or out of this passage.',
    wording: 'Replace vague or repetitive wording with stronger simple vocabulary.',
    smooth: 'Polish awkward phrasing while staying extremely close to the original.',
    stronger: 'Use stronger, more precise vocabulary without making the prose fancy.',
    vivid: 'Make the passage more vivid with restrained sensory or physical detail.',
    continue: 'Write a short continuation that naturally follows the passage. Do not replace it.',
    nextbeat: 'Give a concise possible next story beat, not a full prose rewrite.'
  };

  const strengthGuide = {
    light: 'Change as little as possible. Fix only what clearly helps.',
    balanced: 'Make noticeable improvements while preserving structure and voice.',
    bold: 'You may restructure sentences more freely, but keep the same voice and meaning.'
  };

  const action = mode === 'continue' ? 'append' : mode === 'nextbeat' ? 'idea' : 'replace';
  const instructions = `
You are a live writing coach for a young fantasy web-novel writer.

VOICE TO PRESERVE:
- direct, readable web-novel prose
- relatively short paragraphs
- simple clarity over ornate literary language
- intentional dramatic fragments can stay
- occasional tiny POV shifts can be valid when clearly dramatic
- character thoughts can use single quotation marks
- natural dialogue and physical reactions matter more than elegant prose
- do not imitate another novel or author

TASK:
${modeGuide[mode] || modeGuide.natural}
${strengthGuide[strength] || strengthGuide.balanced}

RULES:
- Return 2 or 3 useful options maximum.
- Keep each option concise.
- For EVERY option, explain specifically why it is better for THIS passage. Point to the original weakness or opportunity (for example repetition, vague wording, stiff dialogue, weak reaction, choppy flow, unclear transition) and then explain what the suggestion improves.
- The reason should usually be 1-2 short sentences, practical and easy for a developing writer to learn from. Avoid generic reasons like 'this flows better' unless you explain exactly why.
- Do not explain basic writing theory unless it directly helps this passage.
- Do not invent lore that conflicts with the supplied story notes.
- Never automatically change the user's draft.
- For mode "nextbeat", give story-beat ideas rather than polished prose.
- For mode "continue", produce a short continuation, roughly 1-2 paragraphs maximum.

Return ONLY valid JSON:
{
  "suggestions": [
    {
      "focus": "short label",
      "reason": "1-2 specific sentences explaining what changed and why this is better than the original for this exact passage",
      "text": "suggested wording, continuation, or beat idea",
      "action": "${action}"
    }
  ]
}`;

  const input = `TITLE: ${String(title).slice(0, 300)}
REQUEST SOURCE: ${source}
FOCUS: ${mode}

CHAPTER GOAL:
${safeGoal || '[not provided]'}

STORY BIBLE / RULES:
${safeBible || '[not provided]'}

PREVIOUS CONTEXT:
${safeBefore || '[none]'}

PASSAGE:
${safeParagraph}

NEXT CONTEXT:
${safeAfter || '[none]'}`;

  const model = process.env.OPENAI_SUGGEST_MODEL || 'gpt-5.6-luna';
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: 'none' },
        instructions,
        input,
        max_output_tokens: 900,
        store: false
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'OpenAI request failed.' });

    const parsed = parseJson(extractOutputText(data));
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3).map(s => ({
      focus: String(s.focus || mode).slice(0, 80),
      reason: String(s.reason || '').slice(0, 900),
      text: String(s.text || '').slice(0, 7000),
      action
    })).filter(s => s.text.trim()) : [];

    return res.status(200).json({ suggestions, model, usage: data.usage || null });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'The suggestion service could not be reached.' });
  }
}
