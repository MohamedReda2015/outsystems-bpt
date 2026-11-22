# BPT review — <Application / processes>

Date: <yyyy-mm-dd> · Reviewer: <name/agent> · Scope: <modules, processes, task screens sampled> · Platform: O11 <PS version> | ODC

## Summary
- Blockers: <n> · Major: <n> · Minor: <n>
- Live instances at review time: <per process / risky activities>
- Top risks: 1) <...> 2) <...> 3) <...>
- Verdict: ready / ready after blockers fixed / needs rework

## Findings (most severe first)
Triage order: Security → Live-instance safety → Data integrity → Operations → Design → Naming.

| # | Rule ID | Severity | Element (Module.Process.Activity or Module.Folder.Action) | Evidence | Fix |
|---|---|---|---|---|---|

## Checker output
<paste `node scripts/check-bpt.mjs inventory.json` output>

## Operational health
- Processes in Error: <n> · Overdue tasks: <n> · Stuck waits: <n> · Event backlog (New/Failed/Dead): <n/n/n>
- Runtime data volume / retention: <...>

## Good practices observed
- <...>


## Evidence and acceptance

- Platform/app type, installed versions/theme where relevant, target environment:
- Existing project decisions and authorized delivery scope:
- Requirement → element/contract → source of data → verification evidence:
- Concurrency, retry/unknown outcome, authorization and failure cases relevant to this change:
- Delivery status: prepared / model validated / merged / published / runtime verified (record only observed stages):
- Not tested, missing dependency or blocked evidence, and the exact next step:
