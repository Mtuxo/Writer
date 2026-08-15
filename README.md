# Ethren Writing Studio V4.5 — Chapter Master Sync

V4.5 keeps the private login, GPT-5.6 writing/review tools, Story Bible sync, mobile UI, continuity tools, and adds a two-way **master chapter archive**.

## New in V4.5

- `data/chapters.json` is the readable master copy of the novel chapters.
- **Publish current chapter** writes one browser chapter to the private GitHub master file.
- **Publish all chapters** replaces the master chapter list with the browser copies.
- **Pull master chapters** merges published master chapters back into the browser while keeping local-only chapters.
- **Undo last pull** restores a local backup made just before a pull.
- **Export chapters** makes a portable JSON chapter backup.

This lets ChatGPT read the published chapter versions from the private `Mtuxo/Writer` repository when the GitHub connector is available. Local browser edits remain private until you publish them.

## Vercel environment variables

Existing:

- `OPENAI_API_KEY`
- `STUDIO_LOGIN_PASSWORD`

New for chapter publishing:

- `GITHUB_SYNC_TOKEN` — a fine-grained GitHub personal access token restricted to the `Writer` repository with **Contents: Read and write** permission.
- `GITHUB_REPO` — optional; defaults to `Mtuxo/Writer`.
- `GITHUB_BRANCH` — optional; defaults to `main`.

Keep `GITHUB_SYNC_TOKEN` only in Vercel Environment Variables. Never paste it into `index.html` or the browser.

After adding/changing environment variables, redeploy so Vercel Functions receive them.
