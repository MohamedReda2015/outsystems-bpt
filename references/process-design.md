# Process design: modeling a workflow that survives production

Rules `PDS-*` and `PNM-*`. Write the design in `templates/process-spec.md` before building.

## 1. Start from the business state machine

1. List the business **statuses** of the record (`Draft`, `Submitted`, `UnderReview`, `NeedsInfo`, `Approved`, `Rejected`, `Cancelled`) and the allowed **transitions** with who may trigger them. This lives in CS (static entity + transition table) and BL (`BLG-05`), with or without a process.
2. Mark which transitions are done by **people** (human activities), by the **system** (automatic activities), by **time** (Wait timeouts, SLAs) and by **external events** (Waits / Conditional Starts on entity events).
3. Only then draw the process. Each activity maps to one or more transitions; every terminal status maps to an End.

If the drawing has no human steps and no waits, revisit `choosing-async-mechanism.md`.

## 2. Launching (`PAR-04`, `PDS-08`, `PDS-09`)

```
Request_Submit (BL Service Action)
  1. Authorize: role + ownership (SEC-01), identity from GetUserId() (SEC-09)
  2. Validate: Request_ValidateSubmit (state = Draft, required fields)
  3. Guard: Request.ProcessId = NullIdentifier()  — or no active process for this record
  4. Transition: Draft → Submitted (writes history)
  5. LaunchRequestApproval(RequestId)  → ProcessId
  6. Request_Update ProcessId = ProcessId  (CRUD wrapper)
  7. Return ActionResult
```
- The process starts **after commit**; if anything fails, the launch rolls back with the rest. On **Oracle or DB2** databases the official docs require committing the transaction **before** launching: there, do the writes, `CommitTransaction` `[commit transaction]`, then launch, and make the launch step idempotent (the duplicate guard) in case the request fails after the commit.
- The duplicate guard (step 3) prevents double-click and retry duplicates. Back it with a unique filtered index or a row lock (`Get<Entity>ForUpdate`) when concurrent submits are possible (`BTX-04`).
- Re-submission after rejection is a **new** process (store the new `ProcessId`; old one is closed) or a modeled rework loop in the same process — pick one per workflow and document it.

## 3. Process data (`PDS-02`)

- **Inputs**: identifiers (`RequestId`) and small immutable context (`SubmittedByUserId`, `Channel`). Never entity records, lists, binaries or Structures carrying business data.
- **Variables**: outcomes of the previous step (`ReviewOutcome`), counters (`ReworkCount`), ids of created things (`TaskId`, `JobId`).
- Each activity **reads the current record** through BL. A record copied into a variable at launch is stale by the time a human decides three days later.
- No personal data or secrets in process variables (`PSC-03`); they are persisted in platform tables and shown in Service Center. Inputs are also copied into the **process entity** when Expose Process Entity is on (automatic for public processes) — keep it off unless a consumer needs it.

## 4. Decisions and ends (`PDS-03`)

- A Decision has one branch per business outcome **plus** a branch for "anything else" that routes to a handled path (log + admin task), not to nowhere.
- Branch labels are the outcomes (`Approved`, `Rejected`, `NeedsInfo`), not `True`/`False`.
- Every path ends at an **End**. Terminal statuses are set by the step before the End, not inferred from "process closed".

## 5. Waiting: events and time (`PDS-04`)

- **Wait** closes on an entity event (Create/Update of an exposed entity) **with a condition** (e.g. `RequestEvent.RequestId = RequestId and RequestEvent.TypeId = EventType.RequesterReplied`) and **always** a **Timeout** with a modeled branch (remind, escalate, auto-close).
- Wait on a **specific event entity or status change**, not on "any update of Request" — any field edit would wake it and the condition gets evaluated against arbitrary changes.
- Timeouts and SLA durations come from configuration (`<App>Config` entity or site property), not literals (`POP-04`).
- SLAs on human tasks: the task row gets `DueOn`; escalation either inside the process (Conditional Start/Wait with timeout → escalate step) or, for uniform rules over many tasks, a timer `Timer_EscalateOverdueTasks` over `<App>Task` (`choosing-async-mechanism.md` §4). Pick one per workflow.

## 6. Cancellation and withdrawal (`PDS-05`)

Model it, so cleanup always runs:
```
Request_Cancel (BL)  → authorize → transition to Cancelled → create RequestEvent(Cancelled)
Process: Conditional Start "OnRequestCancelled" (closes on RequestEvent Cancelled for this RequestId)
         → CloseOpenTasks (automatic: closes <App>Task rows as Cancelled, closes activities)
         → NotifyParticipants (outbox) → End
```
`ProcessTerminate` is for the admin back office and data repair only (`PEX-02`), because it skips cleanup: tasks stay in inboxes, notifications are never sent.

## 7. Loops, parallel work and sub-processes

- **Rework loops** (`PDS-06`): `ReworkCount` incremented each pass; the Decision routes to a terminal or admin path when it reaches the configured limit.
- **Parallel approvals** (`PDS-10`): OutSystems BPT has no parallel gateway. Options:
  1. one task row per approver created by an automatic step, then **Wait** on the task entity until "all closed or any rejected" (condition evaluated in a BL function / aggregate);
  2. one child process per approver (`Execute Process` or `Launch<Child>` per approver) and a Wait on their completion events.
  Never poll in a Wait-timeout loop.
- **Sub-processes** (`PDS-07`): extract with Execute Process when a section is reused by several workflows or the parent passes about 15 activities. Sub-process inputs follow §3.

## 8. Naming and documentation (`PNM-*`)

| Element | Pattern | Avoid |
|---|---|---|
| Process | `<Concept><Workflow>` — `RequestApproval`, `EmployeeOffboarding` | `Process1`, `RequestProcess`, `Workflow` |
| Light BPT process | `Handle<EventEntity>` — `HandleRequestEvent` | `LightProcess1` |
| Human activity | `<Verb><Object>` — `ReviewRequest`, `ProvideMissingInfo` | `HumanActivity1`, `Step2`, `ManagerTask` |
| Automatic activity | `<Verb><Object>` — `AssignReviewer`, `CreateErpOrder` | `AutomaticActivity1`, `DoStuff` |
| Wait | `WaitFor<Event>` — `WaitForPayment` | `Wait1` |
| Conditional Start | `On<Event>` — `OnRequestCancelled` | `ConditionalStart1` |
| Decision | `<Question>` — `ReviewOutcome`, `IsAmountAboveLimit` | `Decision1`, `If` |
| Process variable | PascalCase noun — `ReviewOutcome`, `ReworkCount` | `Var1`, `Temp` |
| Step logic (BL) | `<Concept>_<Step>_Logic` | logic drawn inline in the process |

- Every process, activity, input and variable has a **Description** (`PNM-05`, `HSE-06`): what it does, who acts, the SLA, which status it sets.
- Human activity **titles shown to users** come from translatable resources or the task entity, not from concatenated strings in the process (`PHA-09`).

## 9. Layout (`PDS-07`)

- Top to bottom; happy path straight down; exception, timeout and cancel branches to the right.
- Comments on every Decision and Wait explaining the business rule and the configured timeout.
- About 15 activities per diagram at most; beyond that, sub-processes.
- No crossing connectors; branch labels always visible.

## 10. Design review questions (ask before building)

1. Which question in the mechanism decision table chose BPT?
2. What starts it, and what stops a second instance for the same record?
3. What happens if every human step is ignored for a month?
4. What happens if every automatic step runs twice? Fails? Times out?
5. How is it cancelled, and what cleanup runs?
6. Who can see, claim, complete, reassign each task, and where is that checked on the server?
7. What happens to live instances when version 2 changes step 3?
8. How long are its runtime rows kept, and how many instances per day are expected?
