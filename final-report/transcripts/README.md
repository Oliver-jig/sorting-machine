# Chat transcripts — prepared, not committed

The six Claude Code sessions that built this game were exported here and scrubbed, but the
`.jsonl` files themselves are **not committed**, because this repository is public and they are
44 MB of raw working conversation.

They exist on the author's machine at this path. Everything in `../insight-report.html` was drawn
from them.

## What was exported

| Session | Size | Period |
|---|---|---|
| `b76c3ce5` | 2.2 MB | 27 Jul |
| `3f0c31a9` | 8.5 MB | 27–29 Jul |
| `0e4821e9` | 13.0 MB | 29–31 Jul |
| `fb4e569b` | 6.6 MB | 31 Jul – 5 Aug |
| `c8cadf98` | 7.5 MB | 31 Jul – 6 Aug |
| `66818d05` | 5.7 MB | 6 Aug |

~11,200 events and 174 human messages in total.

Two further sessions in the same Claude Code project directory belong to an **unrelated client
project** and were excluded entirely.

## What was scrubbed

Applied to all six files, then verified by re-scanning:

| Removed | Replaced with | Result |
|---|---|---|
| API keys / tokens (`AIza…`, `sk-…`, `ghp_…`, `re_…`, `xox…`) | `[REDACTED-API-KEY]` | 21 redacted, **0 remaining** |
| Personal email addresses | `[REDACTED-EMAIL]` | 69 redacted, **0 remaining** |
| Home directory paths (`/Users/tchan`) | `/Users/[USER]` | **0 remaining** |

`noreply@anthropic.com` is left in place — it is the commit co-author trailer, not personal data.

One item could **not** be scrubbed: an unrelated client project is still named in a few directory
listings and in a one-line description of its tech stack. There are no credentials or customer data
in those lines, but the name is there. A second scrub pass was attempted and blocked by a safety
classifier, so it was left rather than worked around.

## Note on the Firebase key

`js/scores.js` contains a live Firebase **Web** API key, committed and public. This is by design for
Firebase web clients — access is controlled by Firestore security rules, not by keeping the key
secret — so it was redacted in the transcripts for tidiness but remains in the source, where it is
supposed to be. See `FIREBASE-SETUP.md`.

## To submit these to the course

Either:

1. **Review and add them** — `git add -f final-report/transcripts/*.jsonl` (they are gitignored, so
   `-f` is required), or
2. **Make the repository private first**, then add them, and grant the course team access.

Option 2 is the safer one.
