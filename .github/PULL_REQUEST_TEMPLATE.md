## What changes

<!-- One or two sentences. Link the issue if there is one. -->

## Type
- [ ] New rule(s) — IDs: <!-- e.g. PAA-07 -->
- [ ] Correction of an existing rule or platform fact — IDs:
- [ ] New lesson learned (`PLL-`)
- [ ] Tooling (checker, consistency check, CI)
- [ ] Documentation / adapters

## Checklist
- [ ] Sources added to `research/sources.md` (official or community, with the author's role)
- [ ] Community-only platform values marked *(verify)*
- [ ] Paraphrased, with no copied documentation text
- [ ] No client names, hostnames, credentials or personal data
- [ ] Rule IDs are new or unchanged (never renumbered)
- [ ] `node scripts/check_skill.mjs` passes
- [ ] `node scripts/test_check_bpt.mjs` passes (new checks exercised in `example_inventory_bad.json`)
- [ ] Adapter core-rules blocks in sync (if `adapters/core-rules.md` changed)
- [ ] `CHANGELOG.md` updated
