---
name: outsystems-bpt
description: Design, review and troubleshoot OutSystems 11 BPT and Light BPT processes, task inboxes, retries, cancellation and live-instance upgrades. Includes a process inventory checker. Use for O11 process orchestration; use outsystems-cmf for CMF case behavior. ODC Workflows require their own platform guidance.
license: MIT
metadata:
  version: 1.2.0
  updated: "2026-11-22"
  platform: OutSystems 11 (Reactive Web, Mobile, Traditional Web); ODC notes
  agent-independent: "true"
  companion-skills: outsystems-architecture (layers, modules, ARC/HSE/DAT/SEC/INT rule IDs); outsystems-backend-conventions (BL logic, transactions, errors, timers, BLG/BTX/BER/BAS IDs); outsystems-frontend-conventions (screens, blocks, task UI, FET/CLG/ERR IDs); outsystems-cmf (Case Management Framework on top of BPT); outsystems-live-style-guide (look)
---

# OutSystems BPT

## Scope, evidence and consistency

- Run bundled scripts from the skill directory or use absolute paths; do not assume they exist in the application checkout.
- Establish O11/ODC, application type, installed component versions and the target environment from available evidence; ask only for information that changes the work.
- Separate **platform facts**, **house defaults**, **project decisions** and **observed lessons**. Project conventions choose among supported designs; they cannot change runtime behavior. The FE/CW/BL/CS chain is an O11 house pattern, not an ODC requirement.
- Preserve the user's requested scope and existing authorization. Continue routine reversible work; a skill does not authorize publishing, dependency changes or production operations beyond that scope. Do not introduce phase-by-phase approval unless the user or environment requires it.
- Prefer installed API signatures and version-matched official documentation. A repository development branch, community workaround or old project observation is evidence to investigate, not a release guarantee.
- Report evidence separately: **prepared → model validated → merged → published → runtime verified**. A static checker passing proves only its covered checks on the supplied inventory. Unknown, blocked and not tested remain explicit.
- Read [verification and reliability](references/verification-and-reliability.md) when changing data contracts, concurrent operations, runtime behavior or verification. It contains the concrete acceptance checks and sources for this skill.


This skill makes an agent design, build and review OutSystems processes (BPT) the way a senior OutSystems architect expects to find them in production:
- **the right tool for async work**: BPT only where a stateful, multi-step or human workflow needs it;
- **processes in Core**, thin activities that call BL logic, business status in entities;
- **explicit, authorized launches**, one live process per workflow per record;
- **tasks users can trust**: right assignee, claimed once, completed through a checked use-case action;
- **no process waits forever**: every wait and task has a timeout, an SLA or a cancel path;
- **activities that can run twice** without harm, fail visibly and can be recovered;
- **process changes that never strand live instances**, and BPT data that does not grow forever.

It works for any agent (Claude, Copilot, Cursor, Codex, Gemini, a custom LLM agent) and for humans. Everything is plain Markdown plus zero-dependency Node.js scripts.

## Where this skill sits

| Question | Skill |
|---|---|
| Which module and layer, who may reference whom, app composition, deployment SOPs | **outsystems-architecture** |
| How BL actions, transactions, errors, integrations and timers are written | **outsystems-backend-conventions** |
| How screens, blocks, client actions and forms are written | **outsystems-frontend-conventions** |
| How it looks | **outsystems-live-style-guide** |
| Case-management apps on the OutSystems **Case Management Framework** (statuses, case definitions, CMF activities) | **outsystems-cmf** (CMF builds on this skill) |
| **Processes**: when to use them, where they live, how they are modeled, launched, tasked, secured, recovered, versioned and operated | **this skill** |

When they overlap, the architecture skill owns *where*, the backend skill owns *how server code is written*, and this skill owns *the process model and its contract with BL and the UI*. It cites their rule IDs (`HSE-03`, `BLG-05`, `BTX-05`, `SEC-09`…) and adds its own: `PAR` placement, `PDS` design, `PHA` human activities, `PAA` automatic activities, `PLT` Light BPT, `PEX` errors and recovery, `PVR` versioning, `POP` operations, `PSC` security, `PNM` naming, `PLL` lessons.

## Applying conventions

Use the project's documented architecture, naming and design choices where supported. Use this skill's house defaults when the project has no decision. Official documentation and installed contracts determine platform behavior; house preferences never override those facts. Record a consequential deviation and its reason. Escalate unresolved security, data-integrity or compatibility conflicts, not ordinary naming or layout choices.

## Processes on the 3-layer Canvas

```
END-USER    <App>_Front_End   Task screens (MyTasks, RequestReview) compose CW blocks. No process logic.
                              (Activity Destination may point here on PS 11.8+; the inbox is still yours.)
──────────────────────────────────────────────────────────────────────────────────────────────
CORE        <App>_CW          TaskInbox / TaskActions blocks; data actions call BL. No rules.
            <App>_BL   ◄──    Processes (folder Processes) — the house default.
                              Not a Service module if it holds human activities (PAR-09).
                              Launch / cancel / complete / reassign use-case actions, step _Logic
                              actions the activities call, assignment rules, roles, task queries.
            <Concept>_BPT     Optional sublayer ABOVE BL for large or many workflows (PAR-06).
                              Consumes BL and CS; owns its processes and task actions.
            <App>_CS          Business entities (source of truth for status), <App>Task,
                              <Concept>History, <Concept>Event (Light BPT trigger), CRUD wrappers.
──────────────────────────────────────────────────────────────────────────────────────────────
FOUNDATION  <Concept>_IS      External calls made by activities. <Name>_Lib: logging, notifications.
```
Dependencies point down only (`ARC-01`, `ARC-10`, `HSE-01`). A CS never holds a process; FE, CW, IS and Lib never hold processes (`PAR-01`). Full placement rules: `references/architecture-and-placement.md`.

## Step 0: establish context (before modeling anything)
1. **Platform**: O11 (Platform Server version) or ODC (ODC uses Workflows, not BPT: `references/platform-reference.md` §8). App type and version: Reactive gets human activity **Destination only from Platform Server 11.8**; the Taskbox is Traditional Web. Choose the inbox source deliberately: an application task projection where needed, or CMF’s task store when CMF is installed; avoid duplicate ownership (`PHA-08`). Module type: **human activities are not available in Service modules** (`PAR-09`).
2. **Is a process the right tool?** Run the decision table in `references/choosing-async-mechanism.md`. Many "workflows" are a status field + use-case actions + a timer.
3. **What exists**: existing processes, the task entity, groups and roles, the logging action, `ActionResult`, the transition table, `_IS` modules, config entity. **Reuse before creating.**
4. **Live instances**: if you are changing an existing process, count live instances per activity first (`PVR-01`).
5. **Who acts**: which roles/groups do each human step, what SLA applies, who can cancel or reassign.

## Core conventions (details in the references)

### 1. Choose the mechanism deliberately (`references/choosing-async-mechanism.md`)
| Need | Use |
|---|---|
| Multi-step workflow with human tasks, waits, SLAs, branching, long life (hours–months) | **BPT process** |
| One short automatic step per business event, high volume, no history needed | **Light BPT** on a dedicated event entity |
| Scheduled or batch work over many records | **Timer** (`Timer_<Job>`, backend `BAS-01`) |
| Reliable external side effect after commit (email, SMS, ERP call) | **Outbox entity + Timer or Light BPT** (`BIN-08`) |
| A simple status lifecycle edited by users | **Status + transition actions** (`BLG-05`) — no process |

Record the choice and the reason in the process spec (`PDS-01`).

### 2. The process orchestrates; BL decides; CS remembers (`references/architecture-and-placement.md`)
- Every activity callback is **thin**: map process variables → call **one** BL action (`<Concept>_<Step>_Logic`) → assign outputs (`PAR-02`). No aggregates, SQL, integrations or business rules drawn inside the process.
- The **business entity status is the source of truth** for UI and reports; each step changes it through the BL transition action, which writes history in the same transaction (`PAR-03`, `BLG-05`). Never report on `Process`/`Activity` system tables.
- Store `ProcessId` on the business record or task row (`PDS-09`).

### 3. Launch explicitly, once (`references/process-design.md` §2)
- Launch with the generated `Launch<Process>` action **inside a BL use-case action** (`Request_Submit`) after authorization and validation (`PAR-04`, `PSC-01`). The process starts after the transaction commits.
- Entity-event launch ("Launch On" Create) only on a **dedicated event/queue entity**, never on the main business entity — imports, migrations and copies would launch processes (`PAR-04`, `PLL-01`).
- Guard against duplicates: one active process per workflow per record (`PDS-08`).

### 4. Model for the unhappy paths (`references/process-design.md`)
- **Inputs are ids only** (`RequestId`) plus small immutable context; read current state in every step (`PDS-02`).
- Every Decision covers all outcomes; every path reaches an End (`PDS-03`).
- Every **Wait has a timeout** with a modeled timeout branch; every human step has an **SLA** (due date + escalation) (`PDS-04`).
- **Cancellation is modeled** (Conditional Start or Wait on the cancel event → cleanup → End), not `ProcessTerminate` sprinkled around (`PDS-05`).
- Rework loops carry a **counter and a limit** (`PDS-06`). Parallel work = child processes or per-approver tasks + a Wait on "all done" (`PDS-10`).
- Readable: top-to-bottom, labelled branches, comments, ≤ about 15 activities; extract sub-processes (`PDS-07`).

### 5. Human activities become trustworthy tasks (`references/human-activities-and-tasks.md`)
- Mirror every human activity in an **`<App>Task` row** (CS) created in **On Ready** and closed on completion; the inbox, SLAs, delegation and reporting read that entity (`PHA-03`).
- Assign to a **role or group** resolved by BL (`<Concept>_GetAssignees_Logic`), never a hard-coded user (`PHA-02`).
- Group tasks are **claimed** before work (`ActivityStart` / assign to user) so two people never complete the same task (`PHA-05`).
- Choose explicit `Close<HumanActivity>` / `ActivityClose` or entity-event completion deliberately (`PHA-10`). Read the installed action’s commit semantics. Closing the current activity does not prove that downstream asynchronous work or the next inbox item is ready; the UI must handle pending progression.
- Completion is **one use-case action per task kind** — `Request_Approve(TaskId, Comment)` — that re-checks on the server: current user is the assignee, task open, outcome valid, record in the expected state; then writes outcome + history and closes the activity under a verified transaction/commit plan (`PHA-01`, `PHA-04`, `SEC-09`).
- Notifications on assignment go through an outbox; they never fail the activity (`PHA-06`, `BTX-06`).

### 6. Automatic activities: short, idempotent, observable (`references/automatic-activities-and-light-bpt.md`)
- **Idempotent**: check state before acting; external calls carry an idempotency key (`PAA-01`, `BTX-05`).
- **Short**: well under the platform activity timeout; long work goes to a timer/batch and the process Waits for its completion event (`PAA-02`).
- **No user session**: `GetUserId()` is not the requester. Act as the stored actor or a system user (`PAA-03`).
- Expected business failures → result + Decision branch. Transient integration failures → bounded retry path (counter + Wait timeout as delay). Unexpected failures → log with correlation (`ProcessId`, `ActivityId`, record id) and **let the activity go to Error**, visible and retryable — never swallow (`PAA-04`, `PAA-05`, `PEX-01`).
- **Bound the retries**: the platform retries a failed automatic activity **until it succeeds or the process is terminated**. Record attempts (committed), re-raise below the limit, route to a failure branch at it (`PAA-06`).
- **Light BPT**: Start → one automatic activity → End, launched only by a Create event on an event entity (`Launch<Process>` runs it as regular BPT), Expose Process Entity = No, **Light process execution** ticked on the module in Service Center in every environment. The handler marks the event `Processed`/`Failed` with attempts and last error; a sweeper timer retries or dead-letters — the platform's own Light retry is unbounded and invisible (`PLT-01`…`PLT-05`).

### 7. Recover, monitor, version, purge (`references/operations-and-versioning.md`)
- A role-protected **process admin back office** (via BL) lists processes in Error, overdue tasks, stuck waits and event backlog, and offers retry / skip / reassign / cancel — audited (`PEX-02`, `PEX-03`, `PSC-01`).
- **Never** fix production by updating `OSSYS_BPM_*` tables by hand (`PEX-04`).
- Changing a live process: publishing **upgrades** running instances, and the impact analysis **suspends** those sitting in deleted or moved activities or past changed outputs. Count live instances per activity (`PVR-01`), run the **Impact Analysis in preview** in Service Center (`PVR-06`), remove activities through the official **Deprecated/New Decision** pattern, keep inputs backward compatible (`PVR-02`), test against in-flight instances (`PVR-03`), and review suspended instances after each deploy (`PVR-07`).
- Plan BPT **data growth** — the platform never cleans it up: delete closed instances after an agreed retention through the BPT API, e.g. **BPT Governor** from OutSystems Global Support, keeping history in your own entities; bulk terminate/delete only through change control (`PEX-05`) and **throughput** (no burst of thousands of launches; scheduler threads are limited per front-end) (`POP-01`, `POP-02`).

### 8. Names say what each element does (`references/process-design.md` §8)
| Element | Pattern | Examples |
|---|---|---|
| Process | `<Concept><Workflow>` | `RequestApproval`, `SupplierOnboarding` |
| Light BPT process | `Handle<EventEntity>` | `HandleRequestEvent` |
| Human activity | `<Verb><Object>` (what the person does) | `ReviewRequest`, `ApproveBudget` |
| Automatic activity | `<Verb><Object>` | `NotifyRequester`, `CreateErpOrder` |
| Wait | `WaitFor<Event>` | `WaitForRequesterReply` |
| Conditional Start | `On<Event>` | `OnRequestCancelled` |
| Decision / branches | `<Question>` / outcome labels | `ReviewOutcome` → `Approved`, `Rejected`, `NeedsInfo` |
| BL step action | `<Concept>_<Step>_Logic` | `Request_NotifyRequester_Logic` |
| Task use-case action | `<Concept>_<Outcome>` | `Request_Approve`, `Request_ReturnForInfo` |

No `HumanActivity1`, `AutomaticActivity2`, `Wait1`, `Decision1` (`PNM-02`). Every process, activity and input has a Description (`PNM-05`).

## How to work

### Designing or building a process
1. Do Step 0. Fill `templates/process-spec.md` (trigger, inputs, steps, roles, SLAs, errors, cancel, versioning) and resolve material ambiguities before building; reuse the authorization already given.
2. Build **bottom-up**: CS (status field, transition table, `<App>Task`, `<Concept>History`, event entity) → BL (`_Logic` step actions, assignment, task use-case actions, launch inside the submit action) → process in BL/`_BPT` → CW task blocks → FE task screens.
3. Name and describe every element as you create it.
4. Run the checker on an inventory of the process (hand-written or exported via Service Studio MCP read tools):
   ```
   node scripts/check-bpt.mjs <inventory.json> [--json]
   ```
5. **Verify on the platform** (`PLL-12`): publish when authorized; launch from the real use case; watch it in Service Center → Monitoring → Processes; walk the happy path, rejection, rework limit, timeout/escalation, cancel mid-flight, a forced activity error and its retry, a second user trying to complete someone else's task, and a double-click on Approve. Report what you saw, not what you built.
6. Finish with the build report from the architecture skill (`build-report.md` in the architecture skill’s templates directory when installed; otherwise report the evidence stages and remaining work from this skill’s templates).

### Reviewing
1. Step 0, then run `scripts/check-bpt.mjs` on what you can export.
2. Walk `references/review-checklist.md`; every rule has an ID and severity. Triage: Security → Live-instance safety → Data integrity → Operations → Design → Naming.
3. Write `templates/bpt-review-report.md`: most severe first, each with rule ID, evidence (`Module.Process.Activity`) and a concrete fix.

### Debugging a "stuck" or "missing" task
Follow `references/operations-and-versioning.md` §3 — the triage order (process status → activity status → error log → wait condition/event → assignment → inbox filter) finds most causes in minutes.

## Rules most often broken
- Process launched on Create of the main business entity; a data import launches thousands (`PAR-04`, `PLL-01`).
- Whole records stored in process variables; decisions made on stale data (`PDS-02`).
- Wait with no timeout; processes waiting for years (`PDS-04`).
- Task completed with an `ActivityId` from the client and no assignee check (`PHA-01`).
- Group task completed twice by two users (`PHA-05`).
- `GetUserId()` used inside an automatic activity (`PAA-03`).
- Email sent inside On Ready; SMTP down → task never appears (`PHA-06`).
- Activity renamed or deleted while instances sit in it (`PVR-01`).
- Inbox built straight on `Activity` system tables; slow, no history after purge (`PHA-03`).
- Exception swallowed in an activity; process "completes" with nothing done (`PAA-05`) — or re-raised with no limit and retried for weeks (`PAA-06`).
- Activity closed by an entity event, so the next task appears only after a refresh (`PHA-10`).
- Process deployed over live instances without a preview impact analysis; suspended instances unnoticed (`PVR-06`, `PVR-07`).
- Human-task process placed in a Service module (`PAR-09`).

## Reference map (read only what the task needs)
| File | Read when |
|---|---|
| `references/choosing-async-mechanism.md` | deciding between BPT, Light BPT, timer, outbox or a plain status lifecycle |
| `references/architecture-and-placement.md` | where processes, tasks, events and step logic live; dependencies; cross-app workflows |
| `references/process-design.md` | modeling: launch, data, decisions, waits, SLAs, cancel, loops, parallel, sub-processes, naming, layout |
| `references/human-activities-and-tasks.md` | human steps, task entity, inbox, assignment, claim, completion, delegation, notifications, security |
| `references/automatic-activities-and-light-bpt.md` | automatic activities, idempotency, timeouts, retries, Light BPT event handlers |
| `references/operations-and-versioning.md` | errors, recovery, admin back office, monitoring, stuck tasks, changing live processes, deployment, data growth, throughput |
| `references/platform-reference.md` | process elements, extended and system actions, process entities, platform defaults with sources, app/module-type limits, tooling, upgrade behaviour, ODC |
| `references/lessons-learned.md` | before any real build, change or debugging session (`PLL-*`) |
| `research/sources.md` · `research/assessment-2026-11.md` | where a platform fact comes from (official vs community) and what changed in v1.1.0 |
| `references/review-checklist.md` | any review, audit or "is this right?" question |
| `templates/process-spec.md` · `templates/bpt-review-report.md` | new or changed process; review report |
| `scripts/check-bpt.mjs` | checking a process inventory JSON (`--json`); format in the script header and `scripts/example_inventory.json` |

For requirement-to-runtime handoffs, also use the cross-skill acceptance section in [verification and reliability](references/verification-and-reliability.md); preserve source/story/criterion IDs and the tested application version.
