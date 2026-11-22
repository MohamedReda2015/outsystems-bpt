# Architecture and placement of processes

Where processes, tasks, events and step logic live on the 3-layer Architecture Canvas and in the house 4-module chain (`Front_End → CW → BL → CS`). Layer rules come from the architecture skill (`ARC-*`, `HSE-*`); this file adds the `PAR-*` rules.

## 1. Why processes belong in Core

A process encodes a business workflow: who does what, in which order, under which rules. That is **Core** knowledge, reusable by any End-User app that shows the tasks. A process in an End-User module couples the workflow to one UI and blocks other apps from completing or querying it. A process in CS couples data to behavior and forces CS to consume BL (a forbidden sublayer reference, `ARC-10`).

| Module | Holds processes? | Holds |
|---|---|---|
| `<App>_Front_End` | **No** | Task screens (`MyTasks`, `RequestReview`), composing CW blocks |
| `<App>_CW` | **No** | `TaskInbox`, `TaskCard`, `RequestApprovalActions` blocks; data actions that call BL |
| `<App>_BL` | **Yes (default)** | Folder `Processes`; `Launch` inside use-case actions; step `_Logic` actions; assignment; task use-case actions; task queries; roles |
| `<Concept>_BPT` | **Yes (split)** | Processes + their task actions, when PAR-06 applies; consumes BL and CS |
| `<App>_CS` | **No** | Business entity + status, `<App>Task`, `<Concept>History`, `<Concept>Event`, transition table, CRUD wrappers |
| `<Concept>_IS`, `_Lib`, `_Th` | **No** | Integration wrappers, logging/notification helpers, theme |
| `<Concept>_Sync`, `_Eng` | Light BPT handlers allowed | Heavy processing, sync jobs, event handlers that are not part of a business workflow |

Rule `PAR-01`.

**Module type** (`PAR-09`): Human Activities need UI and are **not available in Service modules**. If your `_BL` is a Service module, processes with human activities go in a `<Concept>_BPT` module of a type that supports them (Reactive/Blank library-style Core module with no screens), or the BL is created as such a module from the start. Automatic-only processes and Light BPT handlers can live in Service modules.

## 2. The BL module with processes

Folders (extending `HSE-04`):

```
<App>_BL
├── Structures/
├── ServiceActions/            Request_Submit, Request_Approve, Task_GetMyList, Task_Claim ...
├── PrivateActions/
│   ├── Request/               Request_Submit_Logic, Request_ValidateSubmit ...
│   └── Process/               Request_NotifyRequester_Logic, Request_GetAssignees_Logic ... (step logic)
├── Processes/                 RequestApproval (process), HandleRequestEvent (Light BPT)
├── Integrations/
└── Roles                      RequestReviewer, RequestApprover, ProcessAdmin
```

- Step logic actions are **public Server Actions** only if a `_BPT` sublayer calls them; otherwise private.
- Task use-case actions (`Request_Approve`) are the only entry points the UI uses to move the workflow (`PHA-04`).

## 3. When to split a `<Concept>_BPT` module (`PAR-06`)

Split when the BL module is a Service module and the workflow has human activities (`PAR-09`), or when **two or more** apply:
- more than about 3 processes, or one process with more than about 15 activities;
- the workflow changes on a different cadence from the BL rules (e.g. business analysts tune it often);
- several End-User apps or teams share the same workflow;
- the BL module is approaching module-health limits (`ARC-12`).

The `_BPT` module sits **above BL** in Core: `_BPT → BL → CS`. It owns the processes, the task use-case actions for its tasks, and the task queries. CW task blocks then consume `_BPT` for task actions and BL for business data. BL never references `_BPT` (that would be a cycle); BL launches a process **only** through a weak path: create an event row that the process listens to, or have the use-case action live in `_BPT`.

## 4. Thin activities (`PAR-02`)

Each automatic activity's logic and each human-activity callback contains only:
1. read process variables;
2. call **one** BL action (`<Concept>_<Step>_Logic`), or one CRUD/task helper;
3. assign outputs to process variables used by the next Decision.

No aggregates, SQL, integration calls, `If` trees with business rules, or `ActivityClose` gymnastics drawn inside the process. Reasons: BL logic is testable, reusable and reviewable; process flows are hard to diff and debug; and changing a process version is riskier than changing an action.

## 5. Business status vs process state (`PAR-03`)

| | Business status (entity) | Process state (platform) |
|---|---|---|
| Owner | CS entity `Request.StatusId`, changed via BL transitions | The BPT engine (`Process`, `Activity` system entities) |
| Used by | Screens, filters, reports, APIs, other apps | The engine; the admin back office; debugging |
| Lifetime | Forever (audited history in `<Concept>History`) | Until purged (`POP-01`) |

Every step that changes the business meaning updates the status through the transition action (`BLG-05`) — e.g. `Request_TransitionTo(RequestId, Status.UnderReview)` — in the same transaction as the activity. UI never infers "Under review" from "there is an open `ReviewRequest` activity". Store `ProcessId` on the record (`PDS-09`) so cancel and admin flows can find the instance.

## 6. Launch and events across modules (`PAR-04`, `PAR-05`)

- **Explicit launch** (house default): the BL use-case action calls `Launch<Process>(RequestId)` after authorization, validation and the status change. The launch is transactional: if the action rolls back, the process never starts.
- **Entity-event launch** ("Launch On" a Create event): only on a **dedicated event entity** (`RequestEvent`, `OutboxMessage`), never on the main business entity — every bulk import, migration, copy or test-data script would start workflows.
- A process in BL/`_BPT` that waits on or launches from an entity in CS needs the entity's **Expose Process Events = Yes** in CS. Enable it only on entities designed as event sources (status-change events, event rows), and document them.
- **Other apps never launch, close or terminate your processes directly.** They call your BL Service Action (`Request_Submit`) or your `_API`; your action decides (`PAR-05`, `ARC-14`).

## 7. Integrations from processes (`PAR-07`)

Activities call external systems only through BL step logic that calls a `<Concept>_IS` (`INT-01`), with explicit timeouts (`BIN-02`) and normalized exceptions (`INT-03`). Prefer an outbox step + Wait for slow or unreliable systems (`PAA-02`).

## 8. Task UI in the house chain (`PAR-08`)

```
Front_End  MyTasks screen ─┐        RequestReview screen (RequestId / TaskId input)
                           ▼                    ▼
CW         TaskInbox block (data action → BL Task_GetMyList)   RequestReviewActions block (Approve/Reject events)
                           ▼                    ▼
BL         Task_GetMyList (filters by GetUserId(), groups, roles)   Request_Approve / Request_Reject (PHA-01, PHA-04)
                           ▼
CS         <App>Task entity (+ RequestId, ActivityId, Status, DueOn …)
```
Screens use CW blocks only (`HSE-03`). Task blocks raise events (`OnCompleted`); the screen navigates.

## 9. Multi-app and domain workflows

- A workflow that spans two domains (e.g. Procurement and Finance) is owned by **one** domain's `_BPT`/`_BL`; the other domain participates through Service Actions or events, not shared processes (`ARC-14`).
- A shared task inbox across apps: a Core `Tasks_CS` / `Tasks_BL` (`Task` entity with `SourceApp`, `SourceRecordId`, `OpenUrl`) that each app's workflows write to through a Service Action. The inbox app consumes only that.
- Multi-tenant: task and event entities are tenant-aware like the business entity; the inbox filter uses the server-side tenant (`SEC-09`).
