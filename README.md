# OutSystems BPT

[![CI](https://github.com/MohamedReda2015/outsystems-bpt/actions/workflows/ci.yml/badge.svg)](https://github.com/MohamedReda2015/outsystems-bpt/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![OutSystems 11](https://img.shields.io/badge/OutSystems-11-red)
![Agent independent](https://img.shields.io/badge/agents-Claude%20%7C%20Copilot%20%7C%20Cursor%20%7C%20Codex%20%7C%20any-6f42c1)

**An agent skill that teaches AI coding agents, and people, to design, build, review and operate OutSystems 11 Business Process Technology (BPT) workflows the way a senior OutSystems architect would.**

It covers when to use a process at all, where processes live on the 3-layer Architecture Canvas, and how they are launched, modeled, tasked, secured, retried, recovered, versioned and cleaned up. Each rule has a stable ID and a severity, so any agent can enforce it in reviews, and every platform fact is traced to an official or community source.

It is plain Markdown plus small zero-dependency Node.js scripts, so it works with Claude (Code, Desktop, API), GitHub Copilot, Cursor, Codex, Gemini CLI, Aider, or your own LLM agents.

---

## Contents
- [What you get](#what-you-get)
- [Install](#install)
- [Use it](#use-it)
- [Repository layout](#repository-layout)
- [Process checker](#process-checker)
- [Rule IDs and severities](#rule-ids-and-severities)
- [Companion skills](#companion-skills)
- [Versioning and releases](#versioning-and-releases)
- [Contributing](#contributing)
- [Disclaimer](#disclaimer)
- [License](#license)

## What you get
| Area | Highlights |
|---|---|
| Mechanism choice | Decision table: status + transitions, timer, outbox, Light BPT or BPT; smells of the wrong choice |
| Placement | Processes in Core (`_BL` or a `_BPT` sublayer), never in Service modules when they have human tasks; thin activities calling BL `_Logic`; business status vs process state; explicit launch; cross-app rules |
| Design | Ids-only process data; Decisions with "otherwise"; Waits with timeouts; SLAs and escalation; modeled cancellation; rework limits; parallel approvals; sub-processes; naming and layout |
| Human tasks | `<App>Task` entity and inbox (Taskbox is Traditional Web; Reactive Destination from Platform Server 11.8), assignment patterns, claim + lock, secure synchronous completion, delegation, outbox notifications |
| Automatic steps | Idempotency, short steps + jobs, no-session identity, **bounded retries** (the platform retries failed activities indefinitely), error visibility |
| Light BPT | Requirements and per-module setup, event-entity pattern, failure tracking, sweeper, kill switch, ordering |
| Operations | Correlated logging, admin back office, triage for stuck tasks, monitoring, official process-upgrade behaviour (suspension, preview Impact Analysis, Deprecated/New pattern), data cleanup (BPT Governor), throughput |
| Evidence | `research/sources.md` marks each platform fact as official or community; values to re-check are marked *(verify)* |
| Tooling | `check-bpt.mjs` process-inventory checker, process-spec and review templates, adapters for Copilot, Cursor and AGENTS.md readers |

## Install
The repository root **is** the skill: `SKILL.md` sits at the top level.

**Claude Code**: for all projects:
```bash
git clone https://github.com/MohamedReda2015/outsystems-bpt ~/.claude/skills/outsystems-bpt
```
```powershell
git clone https://github.com/MohamedReda2015/outsystems-bpt "$HOME\.claude\skills\outsystems-bpt"
```
For one project only, clone it into `<repo>/.claude/skills/outsystems-bpt`. The skill triggers automatically from its description.

**Claude.ai / Claude Desktop**: download `outsystems-bpt-vX.Y.Z.zip` from [Releases](https://github.com/MohamedReda2015/outsystems-bpt/releases) and upload it under *Settings → Capabilities → Skills*.

**Claude API / Agent SDK**: upload it as a custom Skill, or put `SKILL.md` in the system prompt and give the agent read access to `references/`.

**Codex, Gemini CLI, Aider, Jules and other AGENTS.md readers**: add the repo as a folder or submodule of your project and copy [`adapters/AGENTS.md`](adapters/AGENTS.md) to your repository root.

**Cursor**: add the folder to the repo and copy [`adapters/cursor/outsystems-bpt.mdc`](adapters/cursor/outsystems-bpt.mdc) to `.cursor/rules/`.

**GitHub Copilot**: copy [`adapters/copilot-instructions.md`](adapters/copilot-instructions.md) to `.github/copilot-instructions.md`.

**Custom or multi-agent systems**: put [`adapters/core-rules.md`](adapters/core-rules.md) in every agent's system prompt and give agents a file-read tool for the rest. Suggested roles: a **designer** (mechanism choice, process design, spec template), a **builder** (placement, human and automatic activities), and a **reviewer** (checklist + checker → review report that blocks on any Blocker).

## Use it
Example prompts once it is installed:
- "Design an approval workflow for purchase requests with two approval levels and an SLA."
- "Should this notification be a process, a Light BPT handler or a timer?"
- "Review the processes in Orders_BL." — the agent runs the checker on an inventory and walks the checklist.
- "The approver's task doesn't show up in the inbox." — the agent follows the triage in `references/operations-and-versioning.md` §3.
- "We need to remove a step from a process that has live instances."
- "Our automatic activity has been failing and retrying for days."

The agent follows `SKILL.md`: it applies the precedence rules (project conventions > this standard > official guidance; security and live-instance safety are never relaxed silently), reads only the reference files it needs, and reports findings with rule IDs.

## Repository layout
```
SKILL.md                         entry point (frontmatter, Step 0, core conventions, workflows, reference map)
references/                      details loaded on demand
  choosing-async-mechanism.md      BPT vs Light BPT vs timer vs outbox vs status-only
  architecture-and-placement.md    canvas placement, module types, thin activities, launch, cross-app, task UI chain
  process-design.md                state machine first, launch, data, decisions, waits/SLAs, cancel, loops, parallel, naming
  human-activities-and-tasks.md    task entity, callbacks, assignment patterns, secure completion, claim, inbox, delegation
  automatic-activities-and-light-bpt.md  idempotency, short steps, identity, bounded retries, Light BPT pattern
  operations-and-versioning.md     logging, admin back office, triage, monitoring, process upgrade, data growth, capacity
  platform-reference.md            elements, actions, entities, defaults with sources, app/module types, tooling, ODC
  lessons-learned.md               recurring failures → rules (PLL-*)
  review-checklist.md              every enforceable rule with ID and severity
templates/                       process spec, BPT review report
scripts/                         check-bpt.mjs + example inventories; check_skill.mjs, test_check_bpt.mjs (maintenance)
adapters/                        core-rules.md, AGENTS.md, Copilot instructions, Cursor rule
research/                        sources.md (official vs community), assessment notes
evals/                           test prompts with expectations (not shipped in the release zip)
```

## Process checker
```bash
node scripts/check-bpt.mjs scripts/example_inventory.json          # clean example → exit 0
node scripts/check-bpt.mjs scripts/example_inventory_bad.json      # every common mistake → exit 1
node scripts/check-bpt.mjs my-inventory.json --json                # machine-readable
```
The input is a JSON description of your processes (module, module type, launch, inputs, activities with assignment, SLA, closing, retries, handlers…), written by hand or exported with the Service Studio MCP read tools. The format is documented in the script header. **Exit code 1 means Blocker or Major findings**, so it can gate your own CI. Node.js 16+; no packages.

## Rule IDs and severities
Every rule lives in [`references/review-checklist.md`](references/review-checklist.md):

| Group | Covers |
|---|---|
| `PAR` | Placement and architecture |
| `PDS` | Process design |
| `PHA` | Human activities and tasks |
| `PAA` | Automatic activities |
| `PLT` | Light BPT |
| `PEX` | Errors and recovery |
| `PVR` | Versioning and deployment |
| `POP` | Operations, data and capacity |
| `PSC` | Security |
| `PNM` | Naming and documentation |
| `PLL` | Lessons learned (background, not findings) |

Severities: **Blocker** (security hole or production incident waiting to happen), **Major** (real risk or cost), **Minor** (hygiene). IDs are stable across versions. `[auto]` marks rules the checker enforces.

## Companion skills
This skill cites, rather than repeats, the rules of its companions. They are optional, and the skill works alone, but agents give better answers with them installed:

| Skill | Owns |
|---|---|
| [outsystems-architecture](https://github.com/MohamedReda2015/outsystems-architecture) | Layers, modules, dependencies, app composition, deployment SOPs (`ARC`, `HSE`, `DAT`, `SEC`…) |
| outsystems-backend-conventions | How BL code, transactions, errors, integrations and timers are written (`BLG`, `BTX`, `BER`, `BAS`…) |
| outsystems-frontend-conventions | Screens, blocks, client logic (`FET`, `CLG`, `ERR`…) |
| outsystems-cmf | Case Management Framework apps built on BPT |
| [outsystems-live-style-guide](https://github.com/MohamedReda2015/outsystems-live-style-guide) | Visual design, tokens, accessibility |

## Versioning and releases
[Semantic versioning](https://semver.org/) of `metadata.version` in `SKILL.md`: new rules = minor; wording or fixes = patch; a changed meaning of existing IDs = major. See [CHANGELOG.md](CHANGELOG.md).

Pushing a tag `vX.Y.Z` that matches the SKILL.md version runs the checks and publishes a release with the packaged `outsystems-bpt-vX.Y.Z.zip` (repository plumbing, maintenance scripts and evals are excluded). Build the same zip locally with:
```bash
git archive --format=zip --prefix=outsystems-bpt/ -o outsystems-bpt.zip HEAD
```

## Contributing
Rule proposals, corrections (especially platform behaviour on specific Platform Server versions) and real-world lessons are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md): cite a source, paraphrase, include no confidential data, keep rule IDs stable, and run the checks:
```bash
node --test
node scripts/check-bpt.mjs scripts/example_inventory.json --json
```
Also see the [Code of Conduct](CODE_OF_CONDUCT.md) and the [Security policy](SECURITY.md).

## Disclaimer
This is an independent community project. It is **not affiliated with, endorsed by, or supported by OutSystems**. "OutSystems", "Service Studio", "Service Center", "LifeTime", "Forge" and related names are trademarks of OutSystems. The content paraphrases public OutSystems documentation and community material, credited in [`research/sources.md`](research/sources.md), together with the authors' experience. Platform behaviour, limits and defaults change between versions: check critical decisions against the [official documentation](https://success.outsystems.com/documentation/11/) for your Platform Server.

## License
[MIT](LICENSE).


## Reliability review (Unreleased)

The updated guidance separates installed platform behavior, house conventions and observed project lessons. Read [verification and reliability](references/verification-and-reliability.md) for domain acceptance checks and primary sources. Changes are recorded under Unreleased; this does not declare a new upstream release.

Repository maintenance checks (full Git checkout):

```sh
node scripts/check_skill.mjs
node scripts/test_check_bpt.mjs
node --test tests/check-bpt.test.mjs
```

These maintenance scripts are excluded from the release archive.
