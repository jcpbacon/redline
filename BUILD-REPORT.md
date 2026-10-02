# Build report — unattended v1 build

Started and finished 2026-10-02. Final state: `npm run build` passes; `npm test`
506 passed, 17 skipped (the live-Supabase files); `npm run smoke` ran once against
the real model. Orchestrated run: each ticket was built by a subagent from a
written brief, then verified here (typecheck, that ticket's tests, the full suite,
diff read for stubs) before it was committed.

## Where the plan lives

- The tickets are GitHub issues #18–#32 (the open set). #2–#16 are closed duplicates.
- The spec is GitHub issue #1, snapshotted at `scratchpad/redline-v1-spec.md`.
- `.scratch/redline-v1/spec.md` is a reference copy of **another repo's** spec (its
  own header says so). It was not ticketed from or built to.
- Tickets are GitHub issues, so they have no "Status line". A done ticket gets its
  criteria ticked and is closed with a comment naming the commit. A ticket that
  isn't done stays open with a comment saying what is missing.

## Ticket status

**Every ticket is built. None is blocked, and none needed a second attempt.**
"Open" below doesn't mean unbuilt. It means a criterion can only be proven
against a live Supabase project, which doesn't exist yet. Each of those
tickets has a `tests/integration/*-live.test.js` that skips until one does.

| Ticket | State | Commit | What's left |
|---|---|---|---|
| #29 Flags, ranked, verbatim Source Sentence | **Closed** | 4d6877e | none |
| #31 Counter-offer on every Flag | **Closed** | 93f9d57 | none |
| #20 PDF upload | **Closed** | 78111b7 | none |
| #28 DOCX upload | **Closed** | ac0105f | none |
| #32 Recall eval job | **Closed** | b04e0bc | none (the corpus is 3 Documents; the real ~20 is human work) |
| #19 Analyse + summary | Open | ab6de2d, 272c8fc | the live run of `library-live.test.js` |
| #18 Accounts and sessions | Open | 74c778d | sign-up, sign-in and sessions against a real project; `rls-live.test.js` |
| #21 Paste, save, library | Open | 272c8fc | `library-live.test.js` |
| #22 Red Lines | Open | ad99473 | `red-lines-live.test.js`; the seed list needs your ratification |
| #23 Context + dismiss | Open | f7f86c4 | `dismiss-live.test.js` |
| #24 Question box | Open | ca05c61 | `questions-live.test.js` (the signed-out path is fully verified) |
| #25 Library rename/delete | Open | 7dbe0e7 | `manage-live.test.js` |
| #30 Signed-in `/` → app | Open | b8aef43 | `root-live.test.js` (the signed-in 307) |
| #27 Landing page | Open | (built earlier, f0f512e) | see the audit below |

### #27 audit (the landing page was built under the duplicate #2)

| Criterion | Result |
|---|---|
| Renders with no env and no network | Met: only localhost requests, `/` prerenders static |
| No pricing, testimonials, logos, numbers, accuracy figures or lawyer comparison | Met |
| Legible at 400px and desktop | Met |
| Vocabulary | Met for the listed words. The copy says "warning" and "the contract", which is a marketing-copy liberty |
| Five §3.7 points in order | Met |
| "AI-generated, not legal advice" visible before the CTA | Was **not met** (y≈1978 against a CTA at 856). **Fixed**: a line on the index card, y≈178 at desktop and 131 at 400px |
| "Exactly one primary CTA" | **Arguable.** One action and one target, drawn twice (paper tab and second sheet), which DESIGN.md specifies. Left for you |
| "One screen" (story 49) | Not achieved: the page scrolls. It's a design-level call, left for you |

## Decisions made in your absence

1. **Supabase key name.** Your brief said `NEXT_PUBLIC_SUPABASE_ANON_KEY`, but commit
   2f4c14a had already moved the repo to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   because Supabase is retiring anon keys, and `.env.example` uses it. I kept the
   publishable name, which goes in the same slot of `createClient`. Following the
   brief literally would have reverted a deliberate commit.
2. **Analysis works without an account.** Your brief says a pasted Document must be
   analysable with Supabase absent. Ticket #19 assumed a saved Document. So a
   signed-out Reader can paste and analyse, and nothing is stored. A signed-in Reader
   gets the same flow plus saving.

3. **Test runner and typecheck.** Added vitest, typescript and @types/node (dev
   only). The repo is JavaScript, so the typecheck is `tsc --noEmit` with
   `checkJs` through `jsconfig.json`, because Next rewrites a `tsconfig.json`.
4. **Next 16.3.4 → 16.3.8.** The build's own audit refused 16.3.4: critical RCE
   advisory GHSA-vcvr-r3jv-pc5j. The new version is inside the existing `^16` range.
5. **The fixture contract is a brand's standard form a creator can still
   negotiate,** not a pure take-it-or-leave-it contract, so it stays inside
   ADR-0002's segment. It plants 8 clauses (1 critical, 3 high, 4 medium), plus 2
   that are only unusual (governing law, notice address), which must not be flagged.
6. **Paste-and-read lives at `/read`,** inside the `app/(app)` shell. Upload will
   join the same screen, so naming it after paste or upload would stop being
   accurate.
7. **`checked` comes from a constant, not from the model,** so a clean result
   can never show an empty checked-list.
8. **Severity placeholders: critical > high > medium** (PRD §5), kept in one
   module, `lib/analysis/severity.js`. The labels are shown on screen
   ("Severity: critical") because the app shell brief and #29 ask for the enum's
   word. DESIGN.md says rank is shown as an ordinal, never a named level. That
   rule came from the landing page brief, where severity was undecided. **You may
   want to rule on this.**
9. **Drop-log destination (provisional):** one JSON line per dropped Flag through
   `console.error`, tagged `redline.citation_dropped`, so it shows in the
   `next dev` terminal and in Vercel function logs. The line includes the
   sentence the model returned, which can closely paraphrase Document text.
   Nobody is assigned to watch it.
10. **A pasted, unsaved Document's id** in logs is `unsaved:sha256:<hash of text>`.

11. **Accounts are email + password**, through Server Actions with `@supabase/ssr`
    cookie sessions. Sessions refresh in `proxy.js` (Next 16's name for middleware).
    Magic links would need email delivery set up before anything could be tested.
    New dependencies: `@supabase/ssr` and `@electric-sql/pglite` (dev only).
12. **RLS is tested on PGlite.** The real migrations run in an in-memory Postgres
    with a small shim for Supabase's `auth.uid()`, which exists only in the tests.
    The tests act as two Readers and as a signed-out visitor. Weakening a policy
    makes them fail; this was checked. Each database ticket also has a
    `tests/integration/*-live.test.js` that skips until a project exists.
13. **Whole v1 schema written up front** in `supabase/migrations/`, plus later
    files: 0600 (library view, `save_analysis` writes an analysis and its Flags in
    one transaction, nullable Counter-offer), 0700 (Red Line seed marker,
    `flags.matched_red_line_text`). None of them has run anywhere.
14. **`.gitignore` ignored `*.sql`.** I added an exception for
    `supabase/migrations/*.sql`, because otherwise the migrations could never be
    committed.
15. **Signed-in Readers can still read without saving.** Not everyone wants a
    confidential contract stored.
16. **Red Lines:**
    - The seed set is PRD §5 rephrased, marked PLACEHOLDER for your ratification.
    - It is seeded once per Reader, tracked with a marker table, so deleting them
      all doesn't bring them back.
    - Deleting a Red Line is a hard delete.
    - A Flag keeps the wording of the Red Line it broke.
17. **Dismissal:**
    - Only on saved Documents, since an unsaved reading isn't kept.
    - It doesn't carry over to a fresh analysis, because hiding a Flag is the
      Reader's act, never the system's.
    - A Flag keeps its rank number when others are dismissed.
18. **Sign-in lands on `/read`** until #30 settles where a signed-in Reader lands.
19. **`npm test` runs on 2 workers.** Each PGlite file boots its own Postgres, and
    one worker per core ran this machine out of memory: workers died at ~30MB
    heaps with ~3GB of commit memory free. That was hard to diagnose, because the
    run printed only its header and no summary.
20. **Process hygiene.** One build agent stopped its dev server with
    `taskkill /IM node.exe`, which kills every Node process, Claude Code included.
    That is the most likely reason the session died once during #21. No work was
    lost, and the agents' brief now forbids killing Node by name.

21. **Where a signed-in Reader lands: `/read`.** It's the same place sign-in
    lands, kept in one constant (`APP_HOME`, `lib/auth/routes.js`). The Reader
    usually arrives with a new Document, and the library is one click away. This
    is recorded on issue #1. Change the constant if you prefer the library.
22. **PDF:** `pdfjs-dist`, browser-only and lazy-loaded.
    - Line and paragraph breaks are rebuilt from the layout; characters are never
      changed and nothing is de-hyphenated.
    - "Looks scanned" means fewer than half the pages have at least 50 non-space
      characters.
    - Page breaks become one line break.
    - Multi-column reading order isn't attempted.
    - `pdf-lib` is a dev dependency, used only to generate fixtures.
23. **DOCX:** `fflate` plus our own walk of the document XML, not mammoth, so
    every fidelity rule is in one documented file.
    - Tracked changes read as accepted, and fields show what Word displays.
    - Headers, footers, footnotes and comments are not read, and the confirm
      screen says so.
    - The parser is chosen by the file's signature, never its name or type.
24. **Length ceiling:** read from `NEXT_PUBLIC_DOCUMENT_MAX_CHARACTERS` and
    enforced in the browser and on the server. **Unset means no ceiling**, because
    the number is still undecided (issue #1).
25. **Nothing about an uploaded file is kept, not even its name.** The default
    title comes from the text's first line.
26. **Fixtures are pinned `-text` in `.gitattributes`.** `core.autocrlf=true` on
    this machine would otherwise rewrite their line endings on checkout, and the
    tests compare them byte for byte.
27. **Rename/delete:** both live on the Document page only.
    - Deletion asks first, names the Document, and cascades to every reading and
      question.
    - A new trigger (migration 0800) refuses any change to a stored Document's
      text, since every Source Sentence is checked against it.
28. **Questions:**
    - A grounding sentence that isn't verbatim in the Document turns the answer
      into "the document doesn't cover this", and the drop is logged as
      `redline.grounding_dropped`.
    - Follow-ups see the last 10 questions, but grounding is checked against the
      Document only.
29. **Eval matching rule:** normalised Source Sentences match when one contains
    the other, or when ≥60% of the shorter one's distinct words appear in the
    other. The job reports numbers and never gates, since the targets are
    undecided. Smoke and eval analyse with the 7 seed Red Lines, as a new Reader
    would.

30. **Design pass.** Seven boxes and notices had a thick side stripe, the stock
    generated-UI look the design hook flags. All are now bold ink or the
    contract's own type. DESIGN.md documents the input, text link and notice the
    app uses, and adds "No side-stripe borders".

## Real-model smoke run (once, as asked)

`npm run smoke` against the model in `OPENROUTER_MODEL`, through OpenRouter with
the Fireworks provider pinned, on `tests/fixtures/adhesion-contract.txt`:

- **8 Flags returned, 0 dropped by citation verification, 8 kept.**
- **8 of 8 planted clauses found.** Neither "merely unusual" clause (governing law,
  notice address) was flagged.
- The summary was plain English and described the deal accurately.
- **Severity disagreed with the fixture.** Got 6 critical, 1 high and 1 medium;
  the sidecar expects 1 critical, 3 high and 4 medium. Termination, payment,
  morality and indemnification all came back critical.
- **Follow-up (after the build, with your go-ahead): Red Lines are not the cause.**
  I ran the same contract 4 more times, twice with the 7 seed Red Lines and twice
  with none:

  | Run | critical | high | medium | dropped |
  |---|---|---|---|---|
  | with Red Lines | 5 | 2 | 1 | 0 |
  | without | 5 | 2 | 1 | 0 |
  | with Red Lines | 3 | 4 | 1 | 0 |
  | without | 6 | 1 | 1 | 0 |
  | *fixture expects* | *1* | *3* | *4* | |

  So ADR-0003 looks safe here: removing Red Lines doesn't lower severity. The
  real findings are:
  - The model rates severity well above PRD §5's bands.
  - The rating is unstable from run to run. The same input gave 3 critical
    once and 6 another time.

  Both trace to the open severity-scale decision (issue #1): the prompt names
  critical/high/medium but nothing defines what separates them. Severity drives
  ranking, so until the scale is defined the order of the top Flags will shift
  between runs.
  - **Next step (yours):** define each level, e.g. by PRD §5's three tests
    (hard to reverse; cost exceeds the deal; moves a right the Reader doesn't
    know they hold). Those definitions go into the analysis prompt
    (`lib/analysis/index.js`) and `severity.js`. Then add a severity-agreement
    number to the eval.
  - Citation verification held in every run: 40 Flags returned across the 5 live
    runs, 0 dropped, all 8 planted clauses found each time.
- The raw response was recorded (without a model id) in the session scratchpad,
  not the repo.

## Not verifiable here

Supabase does not exist, so none of these have run against a real project:
- the migrations, including RLS on a real Postgres with real Supabase auth (they
  were verified on PGlite with a shim of `auth.uid()`);
- sign-up, email confirmation, sign-in, sign-out and session persistence;
- the PostgREST and RPC paths for save, library, Red Lines, dismiss, questions,
  rename and delete;
- the signed-in redirect from `/`.

The tests for all of these are written: 7 `tests/integration/*-live.test.js`
files, 17 tests, currently skipped. Also not verified:
- `/library` prerenders static when Supabase is absent at build time. With the
  variables set at build (as on Vercel) it should render per request, but that
  wasn't observed.
- Recall on a real corpus. The eval's 90.9% is over hand-built recordings, which
  proves the job works, not the model.
- The clean Document against the real model. Smoke runs only the adhesion
  contract.

## First commands when you sit down

```sh
git pull
npm ci
npm test              # deterministic suite, no key needed (2 workers; see decision 19)
npm run build
npm run smoke         # the fixture contract through the real model; needs OPENROUTER_* in .env.local
npm run dev           # then open /read and paste tests/fixtures/adhesion-contract.txt
```

Then, in this order:

1. **Define the severity scale** (see "Real-model smoke run"). Without it the
   model over-rates and ranking order shifts between runs. Red Lines were ruled
   out as the cause.
2. **Create the Supabase project** and apply `supabase/migrations/` in filename
   order (0100 to 0800). Then set these in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
3. **Run the live suite:** `npx vitest run tests/integration`. It should go from
   17 skipped to 17 passed. When it does, the open tickets above can be closed.
4. **Decide what this build left provisional:**
   - severity names (decision 8);
   - the Red Lines seed list (16);
   - where a signed-in Reader lands (21);
   - the length ceiling (24);
   - who watches `redline.citation_dropped` and `redline.grounding_dropped` (9);
   - the two #27 design calls (one CTA drawn twice; "one screen").
5. **Grow the eval corpus** toward ~20 labelled Documents (`eval/corpus/`, two
   files each). Then run `npm run eval` live.
