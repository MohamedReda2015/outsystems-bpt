# Lessons learned (`PLL-*`)

Failure patterns that recur in BPT workflows on enterprise OutSystems 11 projects (approval portals, case management, onboarding, back-office request handling). Each lesson is a generalized composite: names are neutral and the figures are illustrative of scale, not records of one project. Add your own project lessons at the end with the next free `PLL-` number. Each lesson: what happened, why, the rule.

## Launch and data

**PLL-01 — An import launched thousands of processes.** The approval process used "Launch On: Create Request". A data migration created 40,000 historical requests and the engine started 40,000 approvals, assigning tasks for closed requests and saturating the scheduler for a day. *Why*: entity-event launch fires for every create, whatever the source. *Rule*: launch explicitly from the BL use case; event launch only on dedicated event entities (`PAR-04`, `POP-02`).

**PLL-02 — The process approved the old amount.** The process stored the whole request record as an input; the requester edited the amount while it was under review; the approval step used the stored copy. *Rule*: ids only; read current state in each step; lock editing in statuses that are under review (`PDS-02`).

**PLL-03 — Two approval processes for one request.** A double-click on Submit (and later a retry after a timeout) launched two instances; both created tasks. *Rule*: duplicate guard + `ProcessId` on the record, inside the same transaction (`PDS-08`, `PDS-09`).

## Human steps

**PLL-04 — "The task doesn't show up."** On Ready sent the notification email directly; SMTP was down; the callback failed, the activity went to Error and the task row was never created. *Rule*: On Ready only creates the task and an outbox row (`PHA-06`).

**PLL-05 — A user approved someone else's task.** The completion action took `ActivityId` from the screen and closed it without checking the assignee; changing the id in the browser request worked. *Rule*: completion re-checks assignee, role, status and record state on the server (`PHA-01`).

**PLL-06 — Two approvals for one group task.** Two members of the approver group opened the same task and both pressed Approve; two history rows, two notifications. *Rule*: claim + row lock / optimistic check (`PHA-05`).

**PLL-07 — The inbox got slower every month.** The inbox queried `Activity` joined to `Process` and the business entity, filtered by group membership. After a year of history it took seconds, and after the platform data purge the "completed tasks" view was empty. *Rule*: mirror tasks in `<App>Task` with proper indexes (`PHA-03`, `POP-01`).

**PLL-08 — Tasks assigned to people who had left.** Assignees were stored as user ids in config. *Rule*: assign to roles/groups resolved at task creation, with a fallback group and an alert (`PHA-02`).

## Automatic steps

**PLL-09 — Duplicate ERP orders.** The "create order" step called a slow ERP API with the default timeout; the call succeeded on the ERP side but timed out locally; the activity was retried and created a second order. *Rule*: explicit timeout, idempotency key or lookup-before-create, short steps (`PAA-01`, `PAA-04`, `BIN-02`).

**PLL-10 — Audit columns said "updated by 0".** Step logic called CRUD wrappers that use `GetUserId()`; in the background there is no user. Another step used `GetUserId()` to check a role and always failed. *Rule*: system user or stored actor; background steps call `_Logic`, not role-checking public actions (`PAA-03`).

**PLL-11 — The process completed and nothing happened.** A step caught `AllExceptions` and continued; the integration had failed for a week before anyone noticed. *Rule*: log and re-raise unexpected errors so the activity goes to Error; monitor Error counts daily (`PAA-05`, `PEX-03`).

## Change and operations

**PLL-12 — "Done" from memory was wrong.** A process was reported as working because it validated; in the environment the Wait never closed because the entity's process events were not exposed. *Rule*: verify by launching from the real use case and watching the instance reach an End in Service Center; report only what you saw (architecture lesson on verification).

**PLL-13 — A deployment stranded 300 instances.** A redesign deleted and replaced the review activity; the impact analysis **suspended** every instance sitting in it, and nobody looked at Service Center until users complained. *Rule*: count live instances per activity, run the preview impact analysis, use the Deprecated/New pattern, review suspended instances after each deploy (`PVR-01`, `PVR-06`, `PVR-07`).

**PLL-14 — Processes waiting since 2019.** A "wait for supplier documents" Wait had no timeout; abandoned requests kept active instances forever, cluttering monitoring and growing runtime data. *Rule*: every Wait has a timeout with a modeled branch (`PDS-04`).

**PLL-15 — Cancelling left tasks in inboxes.** Cancel called `ProcessTerminate`; the open task rows and notifications were never cleaned up. *Rule*: model cancellation as an event with a cleanup path (`PDS-05`).

**PLL-16 — Runtime tables in the tens of GB.** A fire-and-forget notification process (one automatic activity) ran millions of times as regular BPT. Service Center process pages and deployments slowed down. *Rule*: Light BPT or outbox for single-step volume; agree retention and purge (`PLT-01`, `POP-01`).

**PLL-17 — A Wait that never closed after a "harmless" refactor.** The event source moved from an update of `Request` to a new `RequestEvent` entity; existing waiting instances still listened to the old event. *Rule*: Wait conditions are part of the live contract; changing them follows the versioning rules (`PVR-01`).

## Added after the 2026-11 research (recurring community issues)

**PLL-18 — An activity retried for three weeks.** A step called an endpoint that had been decommissioned; the exception was re-raised as the standard said, and the engine retried it thousands of times — there is no platform retry cap. *Rule*: bounded attempts with a committed counter and a failure branch (`PAA-06`).

**PLL-19 — "The next task shows up only after F5."** Approve updated the request and relied on a Wait on the entity update to move on; entity events progress asynchronously, so the screen reloaded before the next activity existed. *Rule*: close with `Close<HumanActivity>` / `ActivityClose` in the completion use case (`PHA-10`).

**PLL-20 — The Light BPT handler was not light in production.** It qualified, but "Light process execution" had been ticked only in development, and another caller launched it with `Launch<Process>`; production ran it as regular BPT and filled the process tables. *Rule*: the module setting is per environment and goes in deployment notes; Light handlers are launched only by their event entity (`PLT-01`, `PVR-04`).

**PLL-21 — The approval process would not compile in BL.** BL had been created as a Service module; human activities are not available there. *Rule*: check the module type before placing human-task processes (`PAR-09`).

**PLL-22 — Bulk terminate left orphan tasks.** Support used a bulk-terminate tool to clear old instances; cleanup paths never ran, so task rows stayed open and records stayed "Under review". *Rule*: bulk terminate only through change control with a business-status decision per record (`PEX-05`, `PDS-05`).
