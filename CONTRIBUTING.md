# Contributing

Thanks for helping improve **outsystems-bpt**. This repository is an agent skill: Markdown that AI agents (and people) read to design, build, review and operate OutSystems 11 BPT processes. Every change must stay **accurate, sourced, agent-independent and concise**.

## Ways to contribute
- **Propose a rule**: open a "Rule proposal" issue with the problem, the rule, the severity and a source.
- **Report a wrong or outdated rule or platform fact**: open a "Bug / inaccuracy" issue and link the documentation or a reproducible case. Platform behaviour differs between Platform Server versions — say which one you tested.
- **Add a lesson learned**: a real BPT mistake, written as *what happened → why → rule*, with no client or personal details.
- **Improve tooling**: the process checker (`scripts/check-bpt.mjs`), the consistency checker, or the CI workflows.

## Content rules
1. **Cite sources.** Every new platform fact or rule goes into `research/sources.md`, under *Official / mirror of official docs* or *Community* (with the author's role when visible: staff, MVP, Champion, user). Official sources win when they disagree with community ones; record the disagreement.
2. **Mark uncertainty.** Values that come only from community answers (thread counts, timeouts, retry intervals) are marked *(verify)* in `references/platform-reference.md`.
3. **Paraphrase, don't copy.** Summarize documentation and forum posts in your own words. Short quotes only.
4. **No confidential data.** No client names, internal hostnames, credentials, tokens, phone numbers, personal data or screenshots of private systems. Use neutral examples (`Requests_BL`, `RequestApproval`, `Invoice_IS`).
5. **Explain the reason.** Agents follow rules better when they know *why*. Prefer one sentence of reasoning to an all-caps MUST.
6. **Agent-independent.** Plain Markdown, and zero-dependency Node.js scripts only. Agent-specific instructions go in `adapters/`.
7. **Keep SKILL.md small** (under 250 lines). Details go into `references/`; SKILL.md points to them.

## Rule IDs
- Every enforceable rule lives in `references/review-checklist.md` as `| ID | Severity | Rule | Check / fix |`. Lessons live in `references/lessons-learned.md` as `**PLL-nn — …**`.
- **IDs are stable.** Other skills (e.g. `outsystems-cmf`) cite them. Never renumber or reuse an ID. New rules take the next free number in their group: `PAR` placement, `PDS` design, `PHA` human activities, `PAA` automatic activities, `PLT` Light BPT, `PEX` errors and recovery, `PVR` versioning, `POP` operations, `PSC` security, `PNM` naming. To retire a rule, keep the row and mark it *Deprecated*.
- Rules from companion skills (`ARC-*`, `HSE-*`, `BLG-*`, `FET-*` …) are cited, not redefined here.
- Severity: **Blocker** (security hole or production incident waiting to happen), **Major** (real risk or cost), **Minor** (convention or hygiene). Tag rules the checker enforces with `[auto]`.

## Checker changes
- Document every new inventory field in the header of `scripts/check-bpt.mjs`.
- Exercise each new check in `scripts/example_inventory_bad.json`, keep `scripts/example_inventory.json` clean, and add the rule ID to `scripts/test_check_bpt.mjs`.

## Before you open a pull request
```
node scripts/check_skill.mjs        # frontmatter, links, rule IDs, versions, privacy patterns
node scripts/test_check_bpt.mjs     # checker regression
```
- Update `CHANGELOG.md` (under *Unreleased*, or a new version). Bump `metadata.version` in `SKILL.md` for releases (semantic versioning: new rules = minor, wording fixes = patch, a changed meaning of existing IDs = major).
- If you changed `adapters/core-rules.md`, copy the same text into the marked blocks of `adapters/AGENTS.md` and `adapters/copilot-instructions.md` (CI checks they match).

## Code of conduct
By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
