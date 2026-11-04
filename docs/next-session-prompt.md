Repository: templarkun/aphelion5. Read CLAUDE.md first and follow it: it holds the sources
of truth, the decisions already made, the build stages and the status.

All work so far is on branch `claude/laughing-gates-ecd2tq` and is not merged into main.
Start from that branch: check it out, or base your own branch on it.

State: all 8 build stages are built. `npm run check` runs the typecheck and the tests; 448
should pass before you change anything. `npm run test:ui` builds the web app and checks it
in a real browser (Playwright). Test batches 1-8 are all agreed by the designer. No open
rules questions (`docs/open-questions.md`). Master docs: Core Rules rev 133, Program Spec
rev 22 (links in CLAUDE.md). The plan for the next sessions is `docs/next-sessions.md`.

Still to do by the designer (remind them): copy `tests/batch3.txt` ... `batch8.txt` into
the Project as "claude/Test scenarios batch N.txt", and change Gravity Well's text in the
Project's `Modules.txt` ("one Dark sector or Cleared sector"). This cloud session cannot
read or write the claude.ai Project, so files must be uploaded.

Task: session 1 of `docs/next-sessions.md`.
1. Stage-start routine: check whether the master Core Rules and Program Spec changed since
   rev 133 and rev 22 (Docs tools, read with {"kind":"view","sinceRev":N}); if so, rebuild
   the snapshots and commit.
2. Make the web build playable for the designer without installing anything, and give them
   the link.
3. Ask the designer to play one full mission. Fix what they report: a rule gap goes into
   `docs/open-questions.md` and is asked, never invented.
4. Commit and push to your branch as you go. Report in plain words: what changed, which
   tests pass, open questions.
