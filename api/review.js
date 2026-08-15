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
    if (!match) throw new Error('The AI review was not valid JSON.');
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
    title = 'Untitled', text = '', selection = '', mode = 'chapter', storyBible = '', sceneGoal = ''
  } = req.body || {};
  if (!String(text).trim()) return res.status(400).json({ error: 'No writing was provided.' });

  const deep = mode === 'deep';
  const excerpt = mode === 'selection' && String(selection).trim() ? String(selection).trim() : String(text).trim();
  const safeText = excerpt.slice(0, deep ? 50000 : 32000);
  const safeBible = String(storyBible).slice(0, 30000);
  const safeGoal = String(sceneGoal).slice(0, 2000);

  const instructions = `
You are an editor for a young fantasy web-novel writer. Preserve the writer's voice instead of replacing it.

WRITER'S PREFERRED STYLE:
- direct, readable web-novel prose
- relatively short paragraphs
- simple clarity over ornate literary wording
- occasional dramatic fragments for tension
- occasional tiny POV shifts at scene-appropriate moments
- direct character thoughts can appear in single quotation marks
- action and dialogue should feel natural, not over-polished
- do not make every sentence elegant or metaphorical

REVIEW PRIORITIES:
1. Flow: transitions, sentence movement, awkward stops, repeated information.
2. Naturalness: dialogue/narration that sounds written for the reader rather than lived by the character.
3. Pacing: where the scene drags, rushes, or needs one extra beat.
4. POV: preserve effective tiny POV shifts; flag only confusing head-hopping.
5. Description: vague wording, over-description, missing grounding, or one stronger scene-fitting detail.
6. Grammar and comma placement: give meaningful examples and briefly explain the rule.
7. Trust the reader: flag places where an emotion/fact is shown and then unnecessarily explained.
8. Fragments: preserve effective fragments used for tension, panic, visions, rhythm, or emphasis.
9. Character voice and reactions: note when characters sound interchangeable or react too generically.
10. Continuity: use supplied story notes only; do not invent canon.

${deep ? `DEEP REVIEW MODE:
Look at the chapter as a complete reading experience. Identify the highest-impact structural and line-level issues, what is already working, likely reader reactions, and 2-4 priorities for the next revision. You may give up to 14 issues.` : `NORMAL REVIEW MODE:
Prefer 5-10 high-value issues. Do not nitpick every sentence.`}

Do NOT rewrite the whole chapter.
Do NOT flatten the writer's voice.
If a line works, it is okay to mark it as Keep.

Return ONLY valid JSON in exactly this structure:
{
  "scores": {"flow": 0, "naturalness": 0, "pacing": 0, "clarity": 0},
  "summary": "2-4 sentence overall assessment",
  "priorities": ["priority 1", "priority 2"],
  "readerReaction": "brief description of how a reader is likely to experience the scene",
  "issues": [
    {
      "category": "Flow|Naturalness|Pacing|POV|Description|Grammar|Comma|Trust the reader|Character|Continuity|Keep",
      "quote": "short exact quote",
      "why": "brief explanation",
      "suggestion": "specific advice or short optional example, not a full rewrite"
    }
  ]
}`;

  const input = `TITLE: ${String(title).slice(0, 300)}
REVIEW MODE: ${mode}

CHAPTER GOAL:
${safeGoal || '[not provided]'}

STORY BIBLE / RULES:
${safeBible || '[not provided]'}

${mode === 'selection' ? 'REVIEW ONLY THIS SELECTED PASSAGE:' : 'REVIEW THIS CHAPTER/SCENE:'}
${safeText}`;

  const model = deep
    ? (process.env.OPENAI_DEEP_MODEL || 'gpt-5.6-sol')
    : (process.env.OPENAI_REVIEW_MODEL || 'gpt-5.6-terra');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: deep ? 'medium' : 'low' },
        instructions,
        input,
        max_output_tokens: deep ? 5000 : 3000,
        store: false
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'OpenAI request failed.' });

    const parsed = parseJson(extractOutputText(data));
    return res.status(200).json({ ...parsed, model, usage: data.usage || null });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'The review service could not be reached.' });
  }
}
