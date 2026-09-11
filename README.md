# Redline

A web app that reads a contract, lease, freelance agreement, or terms of service
and tells the reader what they are actually signing — with every warning tied to
the exact sentence it came from.

The application code so far is a minimal Next.js scaffold — enough for a build to
succeed and deploy, nothing else. What mostly exists is the harness: the
research, decisions, and vocabulary needed to build this correctly, whether
that's a human or an AI agent doing the building.

## Start here

- **[`PRD.md`](./PRD.md)** — the brief for the first version: who it's for, the
  problem, what it does, how "good" is measured, and the trade-offs made to get
  there.
- **[`research/summary.md`](./research/summary.md)** — the evidence the brief is
  built on, including the case against the product as originally conceived.
- **[GitHub Issues](https://github.com/jcpbacon/redline/issues)** — the spec
  derived from the brief, and the tickets it gets broken into, are tracked here
  rather than in the repo. The spec is [#1](https://github.com/jcpbacon/redline/issues/1);
  it's broken into tickets [#17](https://github.com/jcpbacon/redline/issues/17)–[#25](https://github.com/jcpbacon/redline/issues/25),
  in dependency order.

## How this repo is organized

Everything outside `research/` and `PRD.md` exists to keep a session — human or
agent, today or months from now — from silently re-deciding or forgetting
something already settled.

| File / folder | What it's for |
|---|---|
| `CLAUDE.md` | Instructions read at the start of every agent session: what's settled and not open for reinterpretation, the scope for this version, what to ask about before deciding, and standing rules. |
| `CONTEXT.md` | The domain glossary — precise definitions for terms like Reader, Document, Flag, Source Sentence, Red Line — so the same word means the same thing in every session. |
| `docs/adr/` | Architecture Decision Records. One numbered file per decision that's hard to reverse, would be surprising without context, or came from a real trade-off — the decision, the alternatives considered, and why. |
| `docs/agents/` | Configuration for the engineering skill pack this repo uses (issue tracker, domain-doc, and triage-label conventions) — tells generic skills how to behave specifically in this repo. |
| `research/` | Raw findings from the initial product research, and the synthesis in `summary.md`. |
| `PRD.md` | The product brief, built from that research plus a structured decision-making session. Cites its sources and marks what's still undecided rather than papering over it. |

The pattern underneath all of it: every file either points to evidence, records a
decision along with its reasoning, or names something as explicitly undecided.
Nothing gets assumed silently.
