# Reliable BPT execution and verification

## State ownership and lifecycle (PRV-01)

Separate business status, process execution status, task assignment and notification delivery. A task claim is not approval; a completed activity is not proof that its downstream job finished. Choose a custom task projection only when required by the app; CMF already owns its activity/task store. If a projection is used, give it an idempotent activity key and reconciliation for missing/stale rows.

Define the terminal outcomes and late-event policy. For parallel approvals specify all/any/quorum, who counts, rejection precedence, cancellation of remaining work and what happens when the approver set changes. Test duplicate and out-of-order completion rather than inferring correctness from the process diagram.

## Atomic claim and completion (PRV-02)

Bind ActivityId to the business record and active process before acting. Re-check assignment/group/delegation, current state, action and required comment on the server. Serialize incompatible outcomes with the backend version/lock pattern. Do not treat ActivityStart alone as a universal concurrency guarantee; verify the installed action and protect custom task state atomically.

List every commit-capable close/assignment call and remote Service Action. Keep validations and intended business/history writes before the applicable boundary. Explicit closure confirms the current activity's outcome; expose pending progression when the next task or integration has not yet appeared. Do not promise a next inbox item merely because the close action returned.

## Retry ownership, leases and rollback (PRV-03)

Choose one retry owner for each failure class: engine retry, modeled Wait/backoff, or a persisted job/event worker. Overlapping retry engines must share atomic claim and deduplication; otherwise the engine and sweeper may execute the same effect concurrently.

An attempt counter incremented in a transaction that is then rolled back does not persist. For expected worker failures, roll back partial work first, then persist masked failure/next-attempt state in an explicitly designed boundary. A separately committed attempt record must not commit unrelated partial business changes. Test this behavior on the target version. Unexpected timeouts may bypass handlers: lease expiry and reconciliation must recover stuck Processing rows.

Light BPT: verify the documented flow constraints, Create-event trigger, Expose Process Events, Expose Process Entity = No, and environment setting followed by republish. A manual launch is regular BPT. Light mode lacks process/activity history, so the event/job row supplies correlation, status, attempts and operational evidence. A paused event left New must be included when the sweeper resumes; selecting Failed only strands it.

## Live changes and operational acceptance (PRV-04)

Capture live instances at the affected activities before changing a process. Test an in-flight instance from the old definition, including waiting, errored and delegated tasks. Preview impact analysis where available, define drain/migrate/retain-old behavior, and examine suspended instances after deployment. Do not delete process definitions or internal rows as a cleanup shortcut.

A process upgrade, termination, retry or replay has business side effects. Scope admin operations by immutable IDs, expected state, reason and audited actor. Keep bulk recovery bounded and stop on an unexpected outcome. Monitoring covers oldest backlog age, failed/dead jobs, stale claims, overdue waits/tasks and reconciliation drift; a count alone can hide one ancient stuck item.

## Verification scenarios

1. Crash after external delivery and before marking Processed: retry uses the same provider key and does not duplicate the effect.
2. Two users approve versus return the same task: one compatible outcome persists; no duplicate history or next task.
3. Pause Light processing, accumulate New events, resume: all eligible New and due Failed rows are recoverable.
4. Close a task whose next activity is asynchronous: current task closes, UI shows pending progression, eventual next state is verified separately.

## Sources and provenance

- [Official Light Processes](https://github.com/OutSystems/docs-product/blob/master/src/building-apps/processes/light-process.md), [Launch Process](https://github.com/OutSystems/docs-product/blob/master/src/building-apps/processes/actions-extended/launch-process-action.md), [Close Human Activity](https://github.com/OutSystems/docs-product/blob/master/src/building-apps/processes/actions-extended/close-human-activity-action.md).
- [Process upgrade](https://github.com/OutSystems/docs-product/blob/master/src/building-apps/processes/process-upgrade/intro.md) and [transaction handling](https://github.com/OutSystems/docs-product/blob/master/src/ref/data/database/handling-transactions.md).
- Retry counts/intervals quoted from old forum tests are historical observations, not release-independent limits. Verify current settings before sizing throughput or recovery.
- Anonymized prior-project review, 2026-11-22: waiting/forwarding paths and notifications could not be called complete while dependencies or runtime access remained missing. The acceptance matrix must preserve that distinction.

### Correlation and evidence across a process boundary

Define a correlation key linking the business command, process instance and relevant activity; a business record ID alone may not distinguish a restarted process. State how duplicate, late, out-of-order and wrong-instance signals are handled. Never advance a newer request from an older activity callback just because the business ID matches.

Acceptance observes durable business state and the intended process/activity state after the relevant transaction has committed. Receiving a launch/close response is an intermediate observation. Use bounded waits with a deadline and a diagnostic result; do not convert polling timeout into permission to replay a non-idempotent command. Include cancellation racing with completion and replay after recovery in the test plan.

Handoff the correlation fields, retry owner, reconciliation action and live-instance upgrade policy to the story skill. These are engineering acceptance cases on top of the installed BPT behavior described earlier.
