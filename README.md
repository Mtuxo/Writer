# Ethren Writing Studio — AI Version

## Files
- `index.html` — writing studio UI
- `api/review.js` — secure server-side AI review endpoint
- `vercel.json` — Vercel config

## Required Vercel environment variable
Create:
- `OPENAI_API_KEY` = your OpenAI API key

Optional:
- `OPENAI_MODEL` = model name. If omitted, the app uses `gpt-5`.

Do not put the API key inside `index.html`.

## Deploy
Upload this folder to a GitHub repository and import that repository into Vercel.
Then add `OPENAI_API_KEY` under the Vercel project's Settings → Environment Variables and redeploy.

The review endpoint sends `store: false`.

## Preloaded novel
This build includes the full current website copies of Chapters 1–7, with the latest Chapter 7 edits, plus a blank Chapter 8.

## Review controls
- AI Review: reviews the whole current chapter.
- Review selection: highlight text in the editor, then review only that passage.
