# Operations, recovery and versioning

Rules `PEX-*`, `PVR-*` and `POP-*`. A process lives longer than the release that created it. Plan how it is watched, repaired, changed and cleaned up before the first instance starts.

## 1. Logging and correlation (`PEX-01`)

- Every step logic and callback logs failures through the **standard logging action** (backend `BER-03`) with: module, process name, `ProcessId`, `ActivityId`, activity name, business record id, attempt count, masked inputs.
- Use the same correlation id across the use case that launched the process, its activities, outbox messages and `_IS` calls (store it on the record or event row).
- Log state changes in your own history entity (`<Concept>History`), not only in platform logs (which are kept for weeks).

## 2. Process admin back office (`PEX-02`, `PSC-01`)

A small, role-protected (`ProcessAdmin`) area, built like any other screen (FE → CW → BL), offering:

| View | Source |
|---|---|
| Processes in **Error**, with the error and the record | BL query over platform process/activity status + your logs |
| **Overdue** tasks by SLA and escalation level | `<App>Task` (`StatusId` open, `DueOn < now`) |
| **Stuck waits** (open longer than their expected timeout) | platform activity status + `ProcessId` on records |
| **Event backlog** (Light BPT / outbox: New, Failed, Dead) | `<Concept>Event`, outbox entities |
| Instance history for one record | `<Concept>History` + task rows |

Actions, each a BL action with role check and an audit row (who, when, why):
- **Retry** an activity in Error (after the fix) · **Skip** an activity (with justification) · **Reassign** a task (`PHA-07`) · **Cancel** the workflow (prefer the modeled cancel event, `PDS-05`; `ProcessTerminate` only for repair) · **Suspend/Resume** a process · **Reprocess** a Dead event.

Service Center (Monitoring → Processes, and the process's page) remains the platform-level tool for operators; the back office is for business support without Service Center access.

**Platform tooling** (`platform-reference.md` §6): **BPT Governor** (Forge, published by OutSystems Global Support) adds count tracking, threshold alarms, retention-based cleanup and bulk terminate/delete; BPT Utils (community) adds bulk terminate and log deletion. **Bulk terminate and delete are irreversible and can leave business data inconsistent** (terminated instances skip cleanup, `PDS-05`): run them only through change control, after listing the affected records and deciding the business status of each (`PEX-05`).

## 3. Triage: "the task doesn't show up" / "the process is stuck"

Work top-down; most causes appear in the first four steps.

1. **Was it launched?** `Request.ProcessId` set? Did the launching transaction commit (or did the use case fail after the launch call)?
2. **Process status** (Service Center or back office): Active, Suspended, Terminated, Closed? `Process_Status` has no "active with errors" — errors show on the **activity**. A **suspended** instance after a deployment points to the impact analysis (§5, step 7).
3. **Current activity and its status**: which activity is open; is it Ready, Running, Waiting, in Error? If Error → read the error and your correlated log. A failing automatic activity retries indefinitely unless bounded (`PAA-06`): look at the retry count, not only the last error.
4. **Waiting on an event?** Check the Wait's condition against the actual event row; is the entity's **Expose Process Events** on; did the event row get created in a transaction that committed; does the condition reference the right id?
5. **Human activity Ready but no task in inbox?** Did On Ready run and create the task row; what assignee did the rule resolve; does the inbox filter (user, role, status, tenant, `IsDeleted`) match?
5b. **The next task appears only after a refresh?** The previous activity was closed by an entity event, which progresses **asynchronously**; close it with `Close<HumanActivity>` / `ActivityClose` in the completion use case (`PHA-10`).
6. **Engine health**: is the BPT scheduler running on the front-ends; backlog of ready activities; recent deployments; thread saturation from a burst (`POP-02`).
7. **Version change**: was the process republished while this instance sat in a removed or changed activity (`PVR-01`)?

Never "fix" by editing `OSSYS_BPM_*` (or other system) tables in production (`PEX-04`). Use system actions through the back office, Service Center, or OutSystems Support.

## 4. Monitoring and alerts (`PEX-03`)

Daily (or more frequent) checks, ideally a timer that writes a summary and alerts the support group:
- count of activities in Error (target: 0) and their retry counts — derive from activity status, `Process_Status` has no error value;
- count of **suspended** instances (after every deployment: `PVR-07`);
- process and activity row counts against thresholds (BPT Governor alarms, or your own query);
- overdue tasks by escalation level;
- Waits open longer than their timeout plus margin (a timeout that did not fire is a symptom);
- Light BPT / outbox events Failed or Dead, and the age of the oldest New event;
- launches per hour vs. the expected volume (detects runaway launches and silent stops).

## 5. Changing a live process (`PVR-*`)

When you publish a changed process, OutSystems **upgrades running instances to the new flow**. On every deployment (Service Studio, Service Center or LifeTime) an **impact analysis** decides, per instance, to upgrade it or **suspend** it (official; full table in `platform-reference.md` §7):
- an instance **in** a deleted activity, or one that would have to run a moved activity again (or should already have run it), is **suspended**;
- changed activity output parameters suspend instances between that activity and the one that uses its outputs; changed process parameters suspend callers that use it via Execute Process — unless the type converts automatically;
- adding activities is safe; instances before a deleted activity follow the new flow, instances after it continue.

Suspended instances stop until someone resumes or terminates them in Service Center. They are the main source of production BPT incidents. Procedure:

1. **Inventory live instances per activity** (`PVR-01`): Service Center (process by process), a query on the platform metamodel, or a monitoring component (BPT Governor counts, Business Activity Monitoring).
2. **Run the impact analysis in Preview mode** (`PVR-06`): upload the new version of the application in Service Center (target environment) and run **Impact Analysis** without deploying. It lists the instances that would be suspended.
3. **Never remove, move, rename or retype an activity that holds live instances.** Use the official pattern instead:
   - add a **Decision** with two branches, **Deprecated** and **New**, that always returns New;
   - move the activities you want to remove into the Deprecated branch; route New to the next kept activity; build the new path there;
   - new instances never enter Deprecated; old instances inside it drain through it;
   - delete the Deprecated branch in a later release, after confirming zero instances there.
4. **Inputs, outputs and variables** (`PVR-02`): adding is safe with a sensible default; removing or retyping can suspend instances and breaks launchers. Keep old ones until drained.
5. **Wait conditions and callbacks** change behavior for instances already waiting: re-check that every waiting instance can still be released (`PLL-17`).
6. **Test with in-flight data** (`PVR-03`): in a non-production environment, start instances on the old version, leave them in each activity, deploy the new version, and drive each one to an End.
7. **After deploying, review suspended instances** (`PVR-07`): Service Center lists them; decide per instance to resume (after confirming the new flow can continue it) or terminate through the admin path with the business status set. Community reports differ on whether a later redeploy resumes previously suspended instances *(verify)* — never rely on it.
8. **Deployment notes** (`PVR-04`): process changes; live instance counts per affected activity; the preview impact analysis result; config to set per environment (groups, SLA durations, kill switches, **Light process execution** on the module); the drain plan; the **forward-fix** plan (redeploying the old version does not move instances back).
9. Deploy outside business peaks and not while a large batch of launches is running (`PVR-05`, architecture `OPS-*`).

Big redesigns: a new process (`RequestApprovalV2`) for new records while the old one drains, then retire the old one. Cleaner than branching inside one diagram for years.

## 6. Data growth (`POP-01`)

- Every BPT instance and activity is stored in platform tables. High-volume or long-lived workflows grow them by millions of rows, slowing the engine, Service Center and deployments.
- Prefer **Light BPT** for high-volume single-step work (no instance history kept).
- Keep business history in **your own entities** (`<Concept>History`, `<App>Task`), so platform runtime data can be archived or purged without losing the audit trail (architecture `audit-trail.md`).
- The platform does **not** clean up BPT data by itself. Delete closed instances older than the retention period through the **BPT API** — most simply with **BPT Governor** (OutSystems Global Support): per-process retention, weekly `Timer_BPTMaintenance`, threshold alarms (`TrackerThresholds`), tracker retention `TrackerRetentionPeriodInDays` (default 1095). Agree retention with the business and compliance, and keep business history in your own entities first. Never hand-delete system tables (`PEX-04`).
- Purge your own event/outbox rows after retention with a timer (`BAS-01`).

## 7. Throughput and capacity (`POP-02`, `POP-03`)

- The engine runs a **limited number of activities in parallel per front-end** — about 10 BPT, 20 Light and 3 timer threads by default *(verify)* (`platform-reference.md` §5). A burst of thousands of launches queues behind everything else, delaying human-facing steps for hours. Instances waiting on a human step or a Wait hold no thread: the limit is on concurrently executing activities, not on live instances.
- Raising thread counts (on-premises configuration) moves the bottleneck to the database; measure before and after.
- Never launch a process per row in bulk imports, migrations or recalculations. Use a timer in batches, or Light BPT with throttling via the event table, or launch gradually.
- Heavy automatic work belongs in jobs (`PAA-02`), not in activities that hold engine threads.
- Very heavy BPT/timer loads: dedicated front-ends or a deployment zone for asynchronous work, like timers (architecture `performance.md`).

## 8. Configuration per environment (`POP-04`)

- Groups and their members, SLA durations, escalation contacts, fallback assignee group, retry limits and delays, kill switches: **configuration entity** with a back office, or site properties for simple per-environment values (`DAT-11`).
- Groups created by code/bootstrap are documented in deployment notes; members are environment data.
- Test overrides (send every notification to a test mailbox) are empty in production and checked explicitly.

## 9. Testing (`TST-*`)

- **Unit/BDD**: test the BL step logic, assignment rules, transition table and task use-case actions directly — that is where the business logic is (`PAR-02`).
- **Process path tests** in a test environment: happy path, each Decision outcome, rework limit, timeout/escalation (with short configured durations), cancel at each stage, forced step failure + retry, concurrent completion, wrong user completing.
- **Version-change test** for every release that touches a process (§5 step 5).
- Do not leave test screens or "launch process" buttons in modules (`ARC-08`); use the admin back office with its role.


## Agent edits through the Service Studio MCP (`PVR-08`)
- Use the O11 process API: `eSpace.CreateProcess` and the node types in `OutSystems.Model.Processes.Nodes`. `eSpace.CreateBusinessProcess` is the ODC Workflows API and fails on an O11 module.
- The official MCP skill documents the process API only as a hand-verified summary: keep each change small, read it back, and **review the flow in Service Studio's process editor** before merging.
- A publish changes how **running instances** continue: apply this file's live-instance rules before asking the user to publish, and never publish a process change without that yes.
