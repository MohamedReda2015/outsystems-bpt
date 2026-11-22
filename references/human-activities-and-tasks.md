# Human activities, the task entity and the inbox

Rules `PHA-*` and `PSC-*`. The Traditional Web **Taskbox** lists platform activities. In Reactive Web, a human activity can have a **Destination** screen from Platform Server 11.8 (earlier versions: none), and OutSystems publishes a how-to and a sample for a Reactive taskbox (`platform-reference.md` §4). Whatever the version, the house standard is **your own task entity and inbox**: it gives SLAs, delegation, fast filtered queries, translatable titles and history that survives BPT data cleanup. Destination (11.8+) is fine as the "open this task" navigation target; it is not the inbox. This file is the house pattern.

Human activities need UI: they are **not available in Service modules** — host human-task processes in a module type that supports them (`PAR-09`).

## 1. The task entity (`PHA-03`)

Mirror every human activity in a business entity in CS. The inbox, SLAs, delegation, reports and audit read it; the platform `Activity` table is only used to keep it in sync.

```
<App>Task  (CS, Public, Expose Read-Only, written by CRUD wrappers)
  Id
  ProcessId            Process Identifier
  ActivityId           Activity Identifier (unique)
  TaskTypeId           static entity: ReviewRequest, ApproveBudget, ProvideMissingInfo …
  RecordId / RequestId business record (one column per concept, or Concept + RecordId for a shared inbox)
  AssignedRoleId       role/group the task is offered to (nullable)
  AssignedUserId       user who claimed or was assigned (nullable until claimed)
  StatusId             Open, Claimed, Completed, Cancelled, Expired
  DueOn                SLA deadline from config
  EscalationLevel      0, 1, 2 …
  OutcomeId            Approved, Rejected, NeedsInfo … (static entity per task type or shared)
  Comment              decision comment (length limit)
  CompletedBy, CompletedOn
  CreatedBy/On, UpdatedBy/On, IsDeleted
Indexes: (AssignedUserId, StatusId), (AssignedRoleId, StatusId), (StatusId, DueOn), unique (ActivityId)
```
Why a mirror and not the `Activity` table:
- inbox queries stay fast and simple, with your own indexes;
- history survives BPT data purge (`POP-01`);
- titles and descriptions are translatable (`PHA-09`);
- delegation, escalation and SLA columns are yours;
- reports and other apps never touch platform tables.

## 2. Lifecycle wiring

| Moment | Where | Does |
|---|---|---|
| Activity becomes ready | Human activity **On Ready** callback → BL `Task_CreateForActivity_Logic(ActivityId, TaskType, RequestId)` | resolves assignees (`PHA-02`), creates the task row (`DueOn`), sets the activity's user/group, writes an outbox notification (`PHA-06`) |
| User opens and claims | `Task_Claim(TaskId)` (BL) | checks the user may take it; assigns the activity to the user (`ActivityStart` / assign-to-user system action); task → Claimed |
| User releases | `Task_Release(TaskId)` | assignee only; activity released; task → Open |
| User completes | `Request_Approve(TaskId, Comment)` etc. (`PHA-04`) | §4 |
| Process cancels | cancel path step `CloseOpenTasks` | open tasks → Cancelled; activities closed/skipped |
| SLA passes | escalation step or `Timer_EscalateOverdueTasks` | `EscalationLevel + 1`, reassign or notify, history row |

Verify exact system action names and signatures in the `(System)` module of your Platform Server before wiring them (`platform-reference.md` §2).

Callback rules:
- **On Ready** only prepares: task row, assignment, outbox row. Never close the activity inside its own On Ready (reported to hang); never send email/SMS there (`PHA-06`).
- **On Close** may guard: if the closing is not valid (record state changed, outcome missing), raise **Abort Activity Change** so the activity does not advance — and log it yourself, as it may not appear in Service Center logs.
- A **due date** on the activity is informational: it does not close the task or fire On Close. SLAs and expiry are modeled (`PDS-04`).

## 3. Assignment (`PHA-02`)

- Assign to a **role or group**, resolved by BL (`<Concept>_GetAssignees_Logic(RequestId, TaskType)`), e.g. "the approver group of the requester's department", "the reviewer for amount bands", with configuration in entities (`POP-04`).
- Never hard-code user ids or emails; never assign to the process launcher by default without a rule.
- Segregation of duties: the BL rule excludes the requester (and previous approvers where required) — enforced again at completion (§4).
- No assignee found → assign to a configured fallback group **and** raise an admin alert. Never leave a task assigned to nobody.
- Choose the group pattern per task type and write it in the spec:
  | Pattern | When | How |
  |---|---|---|
  | **One of the group** | any one member may decide | one activity offered to the group/role; the first to claim owns it (`PHA-05`) |
  | **All of the group / named list** | each member must act (sign-off, voting) | one task row (or child process) per member and a Wait on "all done / any rejected" (`PDS-10`) |
  | **Specific person** | the rule resolves exactly one person (line manager) | assign to that user, still resolved by BL at task creation, with a fallback |
- Avoid creating temporary platform groups per task (a common forum workaround): they leak, and the task entity already carries the assignment.

## 4. Completing a task (`PHA-01`, `PHA-04`) — the critical action

One BL use-case action per task outcome (or per task type with an outcome parameter validated against the type):

```
Request_Approve(TaskId, Comment) : ActionResult            (public Service Action, BL)
  1. Task = <App>Task_GetForUpdate(TaskId)                    row lock: two clicks / two users serialize (PHA-05)
  2. Authorize:
       Task.StatusId in {Open, Claimed}
       Task.AssignedUserId = GetUserId()
         or (Task.AssignedUserId = NullIdentifier() and user has Task.AssignedRoleId)
       user is not the requester (segregation of duties, if the rule says so)
  3. Validate: outcome allowed for Task.TaskTypeId; Comment rules; record status = expected (UnderReview)
  4. Request_Approve_Logic:
       transition Request UnderReview → Approved (history row)          BLG-05
       Task: OutcomeId, Comment, CompletedBy = GetUserId(), CompletedOn, Status = Completed
       close the activity synchronously: Close<HumanActivity>(ActivityId, Outcome…) or ActivityClose   PHA-10
  5. Return ActionResult (expected failures as Errors[], not exceptions)   BER-05
```
- **Close synchronously** (`PHA-10`). Closing through an entity event (the activity's Close On, or a Wait on Update) progresses **asynchronously**: the user lands on the next screen before the next activity exists, and the inbox looks stale (OutSystems staff answer). `Close<HumanActivity>` / `ActivityClose` from the use case moves the process in the same request.
- `TaskId`/`ActivityId` from the client is **only a pointer**: every check is redone on the server (`SEC-01`, `SEC-09`).
- Identity is `GetUserId()`; never a `UserId` input.
- All writes and the activity close are **one transaction**: either the task is completed and the process moves, or nothing happened.
- The process reads the outcome from the task row (or the activity output) in the next Decision — not from a client-supplied value.

## 5. Claim and concurrency (`PHA-05`)

- Group/role tasks: the first user to **claim** owns it; others see it as "In progress by <name>" and cannot complete it.
- Completion uses a row lock or an optimistic `UpdatedOn` check, so a double-click or two simultaneous approvers produce one completion and one friendly "already completed" result.
- Auto-release of claimed-but-idle tasks after a configured time (timer), if the business wants it.

## 6. The inbox (`PAR-08`, `PSC-02`)

- `Task_GetMyList(Filter, StartIndex, MaxRecords)` in BL: tasks where `AssignedUserId = GetUserId()` **or** (`AssignedUserId` empty and the user has `AssignedRoleId`), `StatusId in (Open, Claimed)`, not deleted, paginated, ordered by `DueOn`. The filter is **server-side**; never filter by a user id the client sends.
- Returns a `TaskSummary` Structure (title, record reference, due date, overdue flag, status) — not the task record, not the request record (`BSC-10`).
- Counters ("3 tasks overdue") from a bounded count aggregate, cached briefly if needed (`BPF-03` does not allow caching user-dependent data across users — cache per user only in the client).
- The CW `TaskInbox` block shows loading/empty/error states (frontend `FET-03`).
- Opening a task: screen input is `TaskId` (or `RequestId`); the screen's data action loads it through BL, which re-checks visibility.

## 7. Delegation, reassignment, out-of-office (`PHA-07`)

- `Task_Reassign(TaskId, NewAssigneeUserId, Reason)` — restricted to `ProcessAdmin` or the team lead role, checked in BL, **audited** (history row with old/new assignee and reason).
- Out-of-office delegation: a `Delegation` entity (from, to, period, scope); assignment logic (§3) applies it when the task is created and the inbox query includes delegated tasks.
- Never reassign by editing the task row from a generic CRUD screen.

## 8. Notifications (`PHA-06`)

- On Ready writes an **outbox** row (`NotificationOutbox`: channel, template, recipient resolved server-side, payload ids); a Light BPT handler or timer sends it (`BIN-08`).
- Sending email/SMS directly in On Ready ties task creation to SMTP/SMS uptime: a failure puts the activity in Error and the task never appears.
- Links in notifications point to the task screen with the `TaskId`; the screen still authorizes.
- No personal data beyond need in the message body (`SEC-06`).

## 9. Task screens (`PHA-08`)

- Screens live in the Front-End, composed of CW blocks: record summary block + `<Concept><TaskType>Actions` block (Approve / Reject / Return buttons, comment input).
- Navigation: from the inbox with `TaskId`; on Platform Server 11.8+ the activity's Destination may also point to the task screen (input `ActivityId` from the runtime property) — the screen still resolves the task through BL and authorizes (`PHA-01`).
- Screen roles: the task's roles, never Anonymous/Registered (`SEC-07`).
- Buttons visible according to a server-computed `CanApprove` (visibility only, `FSC-02`); the BL action is the real check.
- After completion: feedback message, then navigate back to the inbox (keeps filters, frontend `NAV-03`).

## 10. Security summary (`PSC-*`)

| Threat | Control |
|---|---|
| User completes someone else's task by changing `TaskId` | Server-side assignee/role check in the completion action (`PHA-01`) |
| User approves own request | Segregation-of-duties rule in assignment **and** completion |
| Two users complete the same group task | Claim + row lock (`PHA-05`) |
| User sees other teams' tasks | Inbox filter by `GetUserId()` and roles in BL (`PSC-02`) |
| User calls launch/cancel/reassign/terminate | Only BL use-case actions with role + ownership checks; system process actions never exposed raw (`PSC-01`) |
| Sensitive data visible in Service Center or logs | Ids only in process variables; masked logs (`PSC-03`) |
