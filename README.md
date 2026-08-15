# Ethren Writing Studio — Complete V4

A private AI-assisted writing studio for the Ethren Hollowmere novel.

## Included

- Chapters 1–7 preloaded, Chapter 8 blank, while preserving the same browser storage key so existing edits survive upgrades.
- Preloaded Character Bible: Ethren, Cassiel, Celestine, Mirelle, Evander, Leandor, Lucan, Alaric, Evelyn, Seraphina, Rowan, Derick, Severin, Hedric, and existing planning notes.
- World Bible tabs: Characters, Vestiges, Principles, Dimensions, Locations, Nobility, Timeline, Relationships, Mysteries, Foreshadowing, Knowledge Map, Canon Memory.
- Character Presence detection for the scene around the cursor.
- Character cards through the World Bible.
- Scene cards per chapter: Goal, Conflict, Reveal, End hook.
- Story Boards: draggable Timeline, Relationship Arcs, Mystery Board, Foreshadowing tracker, Knowledge Map.
- Continuity checker: spelling/name drift, appearance, impossible knowledge, relationship, timeline, location, power, canon-status issues.
- Power-system checker.
- Reader-confusion checker.
- “What happens next?” brainstorming that gives directions, not finished prose.
- “Learn this chapter” memory extraction; proposed facts only become canon when you approve them.
- Reader Mode.
- Live paragraph suggestions, quick AI tools, selection review, normal review, and Deep Review.
- Autosave, local AI undo, TXT export, JSON backup/import, focus mode, word targets, and background themes.
- Optional `STUDIO_ACCESS_CODE` protection so strangers cannot burn API credit.
- Session request/token counter.

## AI memory

The API does not magically inherit ChatGPT conversation memory. The site creates its own persistent novel memory from the World Bible, Canon Memory, Scene Card, and approved chapter facts, then sends relevant memory with AI requests. This is what lets continuity, knowledge, power, relationship, and foreshadowing checks stay consistent.

## Vercel environment variables

Required:

- `OPENAI_API_KEY`

Recommended:

- `STUDIO_ACCESS_CODE`

Optional model overrides:

- `OPENAI_SUGGEST_MODEL`
- `OPENAI_REVIEW_MODEL`
- `OPENAI_ANALYZE_MODEL`
- `OPENAI_DEEP_MODEL`

Defaults use `gpt-5-mini` for live suggestions and `gpt-5` for review/story tools/deep review. If your OpenAI Platform account exposes newer aliases, set the variables above without changing code.

## Upgrade

Replace:

- `index.html`
- `api/review.js`
- `api/suggest.js`
- `api/health.js`

Add/replace:

- `api/analyze.js`

Your existing browser-saved chapter edits should remain because the storage key is preserved.


## V4.2 mobile + GPT-5.6

- Mobile drawer for chapters/tools instead of stacking the whole sidebar above the editor.
- Fixed mobile writing header and bottom dock for Chapters, Review, Bible, and Reader Mode.
- Touch-friendly 44px controls, iPhone safe-area support, 16px form text to avoid iOS zoom, horizontally scrollable quick tools, and full-screen mobile review/Bible/Boards.
- Default models: `gpt-5.6-luna` for live suggestions, `gpt-5.6-terra` for normal review/story intelligence, and `gpt-5.6-sol` for Deep Review.
- Existing environment overrides still work: `OPENAI_SUGGEST_MODEL`, `OPENAI_REVIEW_MODEL`, `OPENAI_DEEP_MODEL`, `OPENAI_ANALYZE_MODEL`.


## V4.3 private login

Set `STUDIO_LOGIN_PASSWORD` in Vercel Project Settings → Environment Variables, then redeploy. The site will redirect every unauthenticated page request to `login.html`, and API routes return 401 until the secure session cookie is present. The cookie is HttpOnly, Secure, SameSite=Strict, and lasts 7 days.

**Important:** if your GitHub `Writer` repository contains your novel text or preloaded story bible, make the repository **Private** too. A Vercel login protects the deployed website, but it cannot hide files that are intentionally public on GitHub.

The old `STUDIO_ACCESS_CODE` variable is no longer used in V4.3 and can be deleted after the new login works.
