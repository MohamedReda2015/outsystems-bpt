# Choosing the mechanism: BPT, Light BPT, timer, outbox or no process

A BPT process is powerful and expensive: every instance and activity is persisted, scheduled by the platform engine, and has to be versioned, monitored and purged for its whole life. Use it when you need what only it gives — durable, multi-step, event-driven state with human tasks — and pick something lighter otherwise. Rule `PDS-01`.

## 1. Decision table

Answer the questions in order; the first "yes" wins.

| # | Question | If yes |
|---|---|---|
| 1 | Is it just a record that moves through statuses when users press buttons, with no waiting on time or external events? | **Status + BL transition actions** (`BLG-05`). No process. Add a timer later for reminders if needed. |
| 2 | Is it scheduled, or does it go over many records at once (nightly sync, reminders, recalculation, purge)? | **Timer** with batches, checkpoint, re-wake and kill switch (`BAS-01`, `DAT-09`). |
| 3 | Is it one short automatic step that must run for every occurrence of a business event (send a notification, push to ERP, recalculate a summary), at volume, with no need to keep history? | **Light BPT** on a dedicated event entity (`PLT-*`), or outbox + timer if you need ordering or rate limits. |
| 4 | Must an external side effect happen reliably *after* the user's transaction commits (email, SMS, REST call), with retries? | **Outbox entity + Timer or Light BPT** (`BIN-08`, `BTX-06`). |
| 5 | Does it involve people doing tasks, waiting for other events or deadlines, branching on outcomes, and living hours to months per record? | **BPT process.** |
| 6 | None of the above, but the user must not wait (> about 2 s)? | Outbox + Light BPT handler, or a timer woken with `Wake<Timer>`. |

## 2. Comparison

| Property | BPT process | Light BPT | Timer | Status + actions |
|---|---|---|---|---|
| Trigger | `Launch<Process>` or entity Create event | Entity Create event only | Schedule or `Wake<Timer>` | User action |
| Steps | Many; human, automatic, wait, decision, sub-process | Exactly one automatic activity | One action (batched) | One per user action |
| Human tasks | Yes | No | No | Users act on screens |
| Waits on events / time | Yes | No | Re-wake only | No |
| Persistence of runtime state | Process + activity rows per instance (grows) | Minimal (no process history kept) | Your own control entity | Your own entities |
| Concurrency | Engine threads per front-end (limited) | Separate, larger thread pool | One run per timer at a time | Request threads |
| Typical life | Hours to months | Seconds | Minutes | n/a |
| Versioning risk | High: live instances | Low | Low | Low |
| Ops burden | Monitoring, recovery, purge, versioning | Event status + sweeper | Run log + kill switch | Low |

Platform numbers (thread counts, timeouts) are in `platform-reference.md` §5 — verify them on your Platform Server.

## 3. Smells that you chose wrong

- A process with **one automatic activity** launched on Create → it should be Light BPT (or outbox + timer).
- A process whose human activities are just "edit the record" with no assignment, SLA or outcome → status + actions.
- A process that **loops with a Wait timeout every few minutes** polling something → a timer, or an event that closes the Wait.
- A timer that keeps **per-record state** across days, with "step" columns and reminders → this is a workflow; consider BPT (or keep it, but document the state machine).
- Thousands of BPT instances launched per hour for fire-and-forget work → Light BPT or outbox (`POP-02`).
- A process used only to "run something in the background" for the user → Light BPT on an event row, or `Wake<Timer>`.

## 4. Mixing mechanisms (normal and good)

- A BPT process whose automatic step needs long work: the step writes a job row and **Waits** for the job's completion event; a timer or Light BPT does the work and updates the row (`PAA-02`).
- A BPT process whose step sends notifications: the step writes an **outbox** row; the outbox handler sends (`PHA-06`).
- SLA escalation for many tasks: a timer `Timer_EscalateOverdueTasks` over the `<App>Task` entity can replace per-process escalation waits when the escalation is uniform (`PDS-04`).

## 5. Record the decision

The process spec (`templates/process-spec.md`) has a "Mechanism" section: the chosen mechanism, the question in §1 that decided it, and what would make you revisit it (volume, new human step, new SLA).
