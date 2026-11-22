# Automatic activities and Light BPT

Rules `PAA-*` and `PLT-*`. Automatic activities run on the platform's scheduler, outside any user request, in their own transaction, possibly more than once. Write them like timer code, not like screen code.

## 1. Execution facts that shape the rules

- An automatic activity runs **asynchronously**, after the transaction that made it ready commits. Nothing the user sees waits for it.
- It runs **without the user's session**: `GetUserId()` does not return the requester; session variables have default values (same as timers, see architecture `data-and-logic.md` §8).
- It runs in **its own transaction**: committed when the activity logic ends, rolled back on an unhandled exception.
- It has a **platform timeout** (minutes, not hours) and a limited number of engine threads per front-end (`platform-reference.md` §5).
- An unhandled exception puts the activity in **Error**, and the engine **retries it until it succeeds or the process is terminated** — there is no platform retry cap (Champion/MVP answers, 2025; `platform-reference.md` §5). Operators can also retry from Service Center. So the logic may run **again** from the start, possibly many times, and a permanent error retries forever unless you bound it (`PAA-06`).

## 2. Idempotency (`PAA-01`)

Every automatic step must be safe to run twice:
- **Check before act**: "if the ERP order for this request already exists, store its id and return".
- External calls carry an **idempotency key** derived from the record and step (`REQ-123-CreateErpOrder`) when the API supports it, or the step first looks up by your reference (`BTX-05`).
- Status transitions are guarded by the transition table: moving `Submitted → UnderReview` twice is a no-op or a handled error, not a duplicate history row.
- Rows created by the step (tasks, outbox messages) use a natural unique key (`ActivityId`, `RequestId + Type + Sequence`).

## 3. Short steps (`PAA-02`)

- Target: seconds. Hard limit: well under the platform timeout.
- Anything long (big reports, file processing, mass updates, slow integrations) → the step writes a **job** row and the process **Waits** for the job's completion event; a timer or Light BPT handler does the work in batches (`BAS-01`).
- No loops over unbounded lists inside a step; no `CommitTransaction` mid-step unless it is a documented batch (`BTX-02`).

## 4. Identity in background steps (`PAA-03`)

- Audit columns: the CRUD wrapper sets `UpdatedBy` from `GetUserId()`, which is the system context here. Decide once per factory: a dedicated **system user** id from config, or the stored actor (`Request.SubmittedBy`) passed explicitly to a `_Logic` overload. Document it.
- Background steps use a same-module private `_Logic` action or an explicitly restricted background contract. Preserve tenant, record-scope and current-state checks; a stored initiator is audit provenance, not current authorization. Keep client-reachable actions protected (`BLG-01`).
- Never use `GetUserId()` to decide whose task or whose record it is.

## 5. Errors and retries (`PAA-04`, `PAA-05`)

| Failure | Handling |
|---|---|
| **Expected business outcome** (record no longer in the right status, rule fails) | Step logic returns a result; process Decision routes to a modeled branch (notify, admin task, End). |
| **Transient technical** (timeout, 503, lock) on an idempotent call | Bounded retry: step returns `ShouldRetry`; process goes to a `WaitForRetry` Wait whose **timeout is the backoff delay** (from config), increments `RetryCount`, loops back; after the limit → admin task / Error path. |
| **Unexpected** (bug, bad data, permanent integration error) | Log once with correlation (`ProcessId`, `ActivityId`, record id, step), then **re-raise while under the attempt limit**: the activity goes to Error, visible in monitoring, and the engine retries it. At the limit, stop retrying (`PAA-06`). |

- Handlers are ordered specific → general, never empty (`BER-02`).
- Never swallow an exception and let the process continue as if the step succeeded — the process "completes" and nothing happened.
- Never put user-facing messages in step errors; nobody is looking at the screen.

### Bounded attempts (`PAA-06`)

The platform retries a failed automatic activity indefinitely, and an unhandled exception rolls back everything the step wrote — including an attempt counter. Pattern:

```
Step logic  <Concept>_<Step>_Logic(RecordId, ProcessId, ActivityId)
  … work …
  AllExceptions handler (Abort Transaction = Yes: the step's partial writes are rolled back)
    1. StepAttempt_Increment(RecordId, Step)   → Attempts, LastError (masked)     own entity, via CRUD
    2. CommitTransaction   [commit transaction]   persists the attempt even though we re-raise
    3. Log with correlation (PEX-01)
    4. If Attempts < MaxAttempts (config)  → re-raise: engine retries
       Else                                → return Outcome = Failed (no raise): the process Decision
                                             routes to the failure branch (admin task, notify, End),
                                             or call ProcessTerminate through the admin path
```
- `MaxAttempts` comes from configuration (`POP-04`); log the final failure at error level and alert (`PEX-03`).
- The engine's retry interval is not under your control. For integration retries with a deliberate backoff, prefer the modeled retry path above (Wait with a timeout as the delay).
- Verify the handler-commit behaviour on your Platform Server in a test environment before relying on it (`PLL-12`).

## 6. Light BPT (`PLT-*`)

Light BPT (light process execution) runs a process made of **Start → one Automatic Activity → End**, launched by an entity **Create** event, on its own larger thread pool and **without keeping process history**. It is the platform's built-in event-handler queue ("scalable database queueing").

### Requirements and setup (official; `platform-reference.md` §5)
- Flow: Start → one Automatic Activity → End.
- **Launch On** a database event (Create of an entity; only Create launches — use a business-event entity for updates).
- Process property **Expose Process Entity = No**.
- In **Service Center → the module → Operation tab**, tick **Light process execution**, apply, and **republish** the module; the compilation message lists the processes that run light. Record this per environment in the deployment notes (`PVR-04`): it is an environment setting, not part of the code.
- .NET Platform Server with SQL Server or Oracle.
- A process launched with `Launch<Process>` runs as a **regular** BPT process even if it qualifies — Light only applies to the event launch.
- Not available in Light mode: process/activity history, callbacks such as On Process Start, output parameters, start dates on the automatic activity, ordering guarantees.

### When (`PLT-01`)
- One short automatic step per business event, at volume: send a notification, push a change to another system, update a summary, index a document.
- Not when you need human steps, waits, multiple steps, or the instance history.

### Pattern (`PLT-02`, `PLT-03`)
```
CS   <Concept>Event       Id, RecordId, TypeId, PayloadRef, StatusId (New, Processing, Processed, Failed, Dead),
                          Attempts, LastError, NextAttemptOn, CreatedOn, ProcessedOn   — Expose Process Events = Yes
BL   <Concept>_RaiseEvent_Logic(RecordId, Type)   called by use-case actions; creates the row (commits with the use case)
BL   Process HandleRequestEvent  (Light)  Launch On: Create <Concept>Event
       └─ automatic activity HandleEvent → <Concept>_HandleEvent_Logic(EventId)
            1. load event; if Status ∉ {New, Failed} → return            idempotent
            2. kill switch on? → leave New, return                       PLT-05
            3. dispatch by Type to step logic (each idempotent)
            4. Status = Processed, ProcessedOn = now
            on expected failure: rollback partial business work, then persist Attempts + 1, LastError = masked message,
                          Status = Failed (or Dead when Attempts ≥ max), NextAttemptOn = backoff;
                          log with EventId; do NOT re-raise (the sweeper retries)
BL   Timer_RetryFailedEvents (every few minutes): eligible New rows after resume, due Failed rows and expired Processing leases → atomically claim and reprocess via the same _Logic, in batches
```
- Trigger on the **event entity**, never the main business entity (`PLT-02`, `PAR-04`).
- Because Light BPT keeps no history, **the event row is the history and the monitor** (`POP-01`, `PEX-03`). Purge `Processed` events after the retention period with a timer.
- Why the handler records failure on the row instead of re-raising: on an unhandled exception the platform does retry Light events by itself (it increments an internal error count and postpones the next run with a growing backoff, up to about once a day, *(verify)*), but that retry is **unbounded, invisible** (no process history, no Service Center instance to look at) and slow to recover. Your event row gives status, attempts, last error, your own backoff, a dead-letter state and a monitor (`PEX-03`). The sweeper is your retry engine.
- Re-raising is acceptable only for a deliberate design that relies on the platform's retry, documented in the process spec with how failures are monitored.

### Limits (`PLT-04`)
- Keep the handler short: the light execution timeout is shorter than a regular activity's (verify, `platform-reference.md` §5). Long work → the handler enqueues a job.
- Ordering is not guaranteed between events; if order matters per record, the handler checks a sequence number or processes "all pending events for this record" in order. For data that arrives in pieces, use the official integration pattern: an **inbound queue** collects the pieces and writes **one** cluster/event row when the record is complete; that row launches the handler.
- Thread pool: about 20 per front-end by default *(verify)*. Raising it (on-premises) can move the bottleneck to the database; prefer fewer, faster handlers.

### Kill switch (`PLT-05`)
A config flag (`<Concept>EventProcessingEnabled`) read at the start of the handler lets operations pause processing without a deployment; events stay `New` and the sweeper picks them up after re-enable.

## 7. Automatic activity checklist

- [ ] Calls one BL `_Logic` action (`PAR-02`)
- [ ] Safe to run twice (`PAA-01`)
- [ ] Seconds, not minutes (`PAA-02`)
- [ ] No `GetUserId()` for business decisions (`PAA-03`)
- [ ] External calls via `_IS`, explicit timeout, bounded retry path (`PAA-04`, `PAR-07`)
- [ ] Unexpected errors logged with correlation and re-raised (`PAA-05`), with a bounded attempt count (`PAA-06`)
- [ ] Business outcome returned for the next Decision (`PDS-03`)
