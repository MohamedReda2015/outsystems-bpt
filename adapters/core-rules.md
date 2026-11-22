# OutSystems BPT — core rules (compact, for any agent)

You are designing, building or reviewing OutSystems 11 processes (BPT / Light BPT). The full skill is in `outsystems-bpt/`: `SKILL.md` is the entry point, `references/` hold the details, `references/review-checklist.md` defines the rule IDs. Layering comes from `outsystems-architecture`; BL code style from `outsystems-backend-conventions`; screens from `outsystems-frontend-conventions`.

**Precedence**: project conventions > this house standard > OutSystems official guidance. Security and live-instance safety rules are never relaxed silently: flag and ask.

**Placement**: processes live in Core — `<App>_BL` (folder `Processes`) or a `<Concept>_BPT` sublayer above BL. Never in Front-End, CW, CS, IS or Lib. Human activities are not available in Service modules. Task screens in Front-End compose CW blocks that call BL. Case-management apps on CMF also follow `outsystems-cmf`.

**Always**
- Choose the mechanism first: status + transitions, timer, outbox, Light BPT, or BPT. BPT only for multi-step, stateful, human or event-waiting workflows.
- Activities are thin: each calls one BL `<Concept>_<Step>_Logic` and maps outputs. Business status lives in the CS entity, changed by BL transitions with history.
- Launch with `Launch<Process>` inside the BL use-case action, after authorization; guard against duplicates; store `ProcessId`. Entity-event launch only on a dedicated event entity.
- Process inputs are ids only; read current state in every step. No personal data or secrets in process variables.
- Every Decision has an "otherwise" path; every Wait has a timeout branch; every human task has an SLA; cancellation is modeled with cleanup; loops have limits.
- Mirror human activities in an `<App>Task` entity; inbox filtered on the server by `GetUserId()`, roles and tenant. Taskbox is Traditional Web; Reactive Destination only from Platform Server 11.8 and only as navigation.
- Task completion = one BL use-case action that re-checks assignee/role, task open, outcome and record state; writes outcome + history and closes the activity synchronously (`Close<HumanActivity>`/`ActivityClose`, not entity events) in one transaction; claim + lock for group tasks. Never close an activity in its own On Ready.
- Automatic activities: idempotent, seconds not minutes, no `GetUserId()` decisions, `_IS` with explicit timeouts, unexpected errors logged with `ProcessId`/`ActivityId` and re-raised — with a committed attempt counter and a limit, because the platform retries failed activities until success or termination.
- Light BPT: Start → one automatic activity → End, Create event on a dedicated event entity (never `Launch<Process>`), Expose Process Entity = No, "Light process execution" ticked on the module in every environment; handler records Processed/Failed/Dead; sweeper timer; kill switch.
- Notifications via outbox, never directly in callbacks.
- Changing a live process: publishing upgrades instances and suspends those in deleted/moved activities. Count live instances per activity; run Service Center Impact Analysis in preview; remove activities via the Deprecated/New Decision pattern; test with in-flight instances; review suspended instances after deploy.
- Admin back office (role-protected, audited) for retry/skip/reassign/cancel; monitoring of activity errors, suspended instances, overdue tasks, stuck waits, event backlog; never write to platform system tables; bulk terminate/delete only through change control.
- Plan data growth (the platform never cleans BPT data: retention + BPT API cleanup such as BPT Governor, history in own entities) and throughput (no launch bursts).
- Verify on the platform before saying "done". Check inventories with `scripts/check-bpt.mjs`.
