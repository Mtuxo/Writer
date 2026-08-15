export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
  }

  const { title = "Untitled", text = "", selection = "" } = req.body || {};
  if (!text.trim()) return res.status(400).json({ error: "No writing was provided." });

  const excerpt = selection.trim() || text.trim();
  const maxChars = 22000;
  const safeText = excerpt.slice(0, maxChars);

  const instructions = `
You are an editor for a young web-novel writer. Preserve the writer's voice instead of replacing it.

The writer's preferred style:
- direct, readable web-novel prose
- relatively short paragraphs
- simple clarity over ornate literary wording
- occasional dramatic fragments for tension
- occasional tiny POV shifts at scene-appropriate moments
- direct character thoughts can appear in single quotation marks
- action and dialogue should feel natural, not overly polished
- do not make every sentence elegant or metaphorical

Review priorities:
1. Flow: scene transitions, sentence-to-sentence movement, awkward stops, repeated information.
2. Naturalness: dialogue or narration that sounds written for the reader rather than something a character would actually say/think.
3. Pacing: where the scene drags, rushes, or needs one extra beat.
4. POV: distinguish effective tiny POV shifts from confusing head-hopping.
5. Description: vague wording, over-description, or places needing one stronger detail.
6. Grammar and comma placement: mention only meaningful examples and briefly explain the rule.
7. Trust the reader: flag places where an emotion or fact is shown and then unnecessarily explained.
8. Fragments: preserve effective fragments used for tension, panic, visions, rhythm, or emphasis; only flag fragments that feel accidental.

Do NOT rewrite the entire chapter.
Do NOT flatten the writer's voice.
Prefer 5-10 high-value issues rather than nitpicking everything.
If a passage already works, say so.
Return ONLY valid JSON in exactly this structure:
{
  "scores": {
    "flow": 0-100,
    "naturalness": 0-100,
    "pacing": 0-100,
    "clarity": 0-100
  },
  "summary": "2-4 sentence overall assessment",
  "issues": [
    {
      "category": "Flow|Naturalness|Pacing|POV|Description|Grammar|Comma|Trust the reader|Keep",
      "quote": "short exact quote from the submitted writing",
      "why": "brief explanation",
      "suggestion": "specific advice or a short optional example, not a full rewrite"
    }
  ]
}
`;

  const input = `TITLE: ${title}

${selection.trim() ? "REVIEW ONLY THIS SELECTED PASSAGE:\n" : "REVIEW THIS CHAPTER/SCENE:\n"}
${safeText}`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5",
        instructions,
        input,
        store: false
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(data);
      return res.status(response.status).json({ error: data?.error?.message || "OpenAI request failed." });
    }

    const outputText =
      data.output_text ||
      (data.output || [])
        .flatMap(item => item.content || [])
        .filter(c => c.type === "output_text")
        .map(c => c.text)
        .join("");

    if (!outputText) return res.status(502).json({ error: "The AI returned no review text." });

    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      const match = outputText.match(/\{[\s\S]*\}/);
      if (!match) return res.status(502).json({ error: "The AI review was not valid JSON." });
      parsed = JSON.parse(match[0]);
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "The review service could not be reached." });
  }
}

