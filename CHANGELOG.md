# Changelog

## Unreleased — cross-skill delivery review (2026-11-22)

- Connected requirements, domain implementation and runtime evidence through stable IDs and versioned handoffs.
- Added domain acceptance guidance, template evidence fields and sourced review checks.


## Unreleased — reliability review (2026-11-22)

- Clarified platform facts versus house/project conventions and verification evidence.
- Added domain-specific reliability guidance, source provenance and acceptance cases.
- Added review/template checks and corrected over-broad or inconsistent claims.
- Added pending-progression handling for event-driven activity closure and behavioral regression checks in CI.
- Extended repository consistency checks to the new reliability rule IDs and aligned contributor guidance with the full checkout.


All notable changes to this skill. Versions follow [semantic versioning](https://semver.org/) of `metadata.version` in `SKILL.md`.

## 1.2.0 — 2026-11-22
Prepared for public release on GitHub.

**Added**
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md`.
- GitHub issue templates (bug / inaccuracy, rule proposal, contact links) and a pull request template.
- CI workflow (Node 16, 20, 22): skill consistency, checker regression, checker exit codes, packaging smoke test. Release workflow: a tag `vX.Y.Z` matching `SKILL.md` builds and publishes `outsystems-bpt-vX.Y.Z.zip`.
- Adapters: `adapters/core-rules.md` (single source), `adapters/copilot-instructions.md`, `adapters/cursor/outsystems-bpt.mdc`; `AGENTS.md` now embeds the same block.
- `check_skill.mjs`: adapter blocks must equal `core-rules.md`; community files must exist; private project and client names are rejected; Cursor rules scanned for rule IDs.

**Changed**
- README rewritten for a public audience: install per agent, usage, layout, checker, rule IDs, companion skills, versioning, disclaimer.
- `.gitattributes` excludes `.github/`, maintenance scripts and `evals/` from the release zip; `.gitignore` ignores local inventories (`inventory*.local.json`).

## 1.1.0 — 2026-11-22
Research-driven update: official OutSystems 11 process docs (via a docs mirror, flagged for re-verification), OutSystems product updates, OutSystems Global Support's BPT Governor, and forum answers by staff, MVPs and Champions. Rationale: `research/assessment-2026-11.md`. Sources: `research/sources.md`.

**Corrected**
- Reactive human activity **Destination exists from Platform Server 11.8** (v1.0 said Reactive had none). `PHA-08` reworded; the task-entity inbox stays the standard.
- Publishing a changed process **upgrades** instances and **suspends** those it can't upgrade (v1.0 said "Error"). `operations-and-versioning.md` §5 rewritten; `PLL-13` corrected.
- Failed automatic activities **retry until success or termination**: "always re-raise" is now bounded by an attempt limit.

**Added**
- Rules `PAR-09` (no human activities in Service modules), `PHA-10` (synchronous close; not in On Ready), `PAA-06` (bounded retries with a committed counter), `PEX-05` (bulk terminate/delete under change control), `PVR-06` (preview Impact Analysis), `PVR-07` (review suspended instances after deploy).
- `PLT-01` extended: Create-event launch only (`Launch<Process>` runs it as regular BPT), Expose Process Entity = No, module setting "Light process execution" per environment. `POP-01` names the BPT API / BPT Governor.
- Platform reference rewritten: extended actions (`Close<HumanActivity>`, `Close<Wait>`, `Start<ConditionalStart>`), Abort Activity Change exception, process entities (`Is_Suspended`…), threads and timeouts with sources, Light requirements, upgrade behaviour table, Oracle/DB2 commit-before-launch, tooling (BPT Governor, BPT Utils, BAM), ODC Workflows update.
- Group assignment patterns (one-of-group, all-of-group, specific person); On Ready / On Close callback rules; due dates are informational.
- Lessons `PLL-18`…`PLL-22`.
- Checker: `platformServer`, `moduleType`, `closedBy`, `closesInOnReady`, `boundedRetry`, `exposeProcessEntity`, `lightExecutionEnabled` fields and the checks for `PAR-09`, `PHA-08` (by version), `PHA-10`, `PAA-06`, `PLT-01`; examples and regression test extended.
- `research/` folder; companion link to `outsystems-cmf`; process-spec template sections for Light setup, retry limits, preview impact analysis and post-deploy review; eval 5.

## 1.0.0 — 2026-11-22
First release.
- `SKILL.md`: BPT on the 3-layer Canvas and the house chain, Step 0, core conventions, workflows for building, reviewing and debugging.
- References: mechanism choice, architecture and placement, process design, human activities and tasks, automatic activities and Light BPT, operations and versioning, platform reference, lessons learned (`PLL-01`…`PLL-17`), review checklist (`PAR`, `PDS`, `PHA`, `PAA`, `PLT`, `PEX`, `PVR`, `POP`, `PSC`, `PNM`).
- Templates: process spec, BPT review report.
- Scripts: `check-bpt.mjs` (process inventory checker), `test_check_bpt.mjs`, `check_skill.mjs`; example inventories.
- `adapters/AGENTS.md` core rules for non-Claude agents; `evals/evals.json`.
