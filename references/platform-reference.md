# Platform reference: BPT in OutSystems 11

What the platform gives you, and its known limits, with the strength of each source (`research/sources.md`). **Names, signatures and defaults vary by Platform Server version: verify them in Service Studio (the `(System)` module, process properties), Service Center and the official docs before you design around them** (`PLL-12`). Values marked *(verify)* come from community answers; treat them as orders of magnitude.

## 1. Process elements (process flow editor)

| Element | Purpose | Notes |
|---|---|---|
| **Start** | Entry; the process inputs | One per flow. **Launch On** a Create entity event adds an input with the entity id |
| **Human Activity** | A task for a person | Assigned to user/group; callbacks (e.g. On Ready, On Close) run server logic; closed by `Close<HumanActivity>`, `ActivityClose` or an entity event (Close On). **Not available in Service modules** (needs UI) |
| **Automatic Activity** | Server logic run by the engine | Logic runs asynchronously in its own transaction; can have outputs and local variables |
| **Wait** | Pause until an entity event (with condition) or a timeout | Also closable explicitly with `Close<Wait>` |
| **Decision** | Branch on an expression | One connector per outcome; add an "otherwise" path |
| **Conditional Start** | Start a parallel flow inside the process on an event | Also startable with `Start<ConditionalStart>`; used for cancel, escalation, "requester replied" |
| **Execute Process** | Run a sub-process | Changing the sub-process's parameters can suspend callers on upgrade (§7) |
| **Send Email** | Send an email from the process | Prefer the outbox pattern for reliability (`PHA-06`) |
| **End** | Terminates the flow | Every path needs one |
| **Comment** | Annotation | Use on every Decision and Wait |

## 2. Actions (official extended actions; verify System names)

**Process extended actions** (generated per process; official):
| Element | Action | Use |
|---|---|---|
| Process | `Launch<Process>` (Arguments = inputs; output `Id`) | Explicit launch from a BL use case (`PAR-04`). Launching a Light-eligible process this way runs it as a **regular** process |
| Human Activity | `Close<HumanActivity>(ActivityId, outputs…)` | Synchronous close with typed outputs from the completion use case (`PHA-10`) |
| Wait | `Close<Wait>` | Release a wait explicitly and synchronously |
| Conditional Start | `Start<ConditionalStart>` | Start a parallel branch explicitly |

**System actions** include activity and process operations such as `ActivityClose`, `ActivityOpen`, `ActivityStart`, `ActivityRelease`, `ActivitySkip`, `ActivityAssignToUser`, `ActivityGetUrl`, `ProcessTerminate`, `ProcessSuspend`, `ProcessResume` (exact set and parameters per version; a BPT API module adds maintenance actions such as deleting closed process data — used by BPT Governor). `ActivityClose` closes **human** activities; it does not end a process. Wrap every one you use in a BL action with role and state checks (`PSC-01`). Never call them from client logic.

**Exceptions in callbacks**: raising an **Abort Activity Change** exception in an activity callback prevents the activity from moving to its next state (use for "On Close" guards). Community reports say it is not logged as an error in Service Center *(verify)* — log it yourself if you need the trail.

**Closing behaviour**: the generated close action closes the current human activity server-side; entity-event progression is asynchronous. A historical staff observation about synchronous progression is not a guarantee that every downstream callback or next inbox row is ready. Verify the installed version and expose a pending state. Closing an activity inside its **own On Ready** has been reported to hang — don't.

## 3. System and process entities (read-only)

- System entities: `Process`, `Activity`, `Process_Definition`, `Activity_Definition`, process/activity status static entities, `Group`, `Group_User`, `Group_Role`, `User`. Use them in BL queries for the admin back office and to sync the task entity; do not build user-facing inboxes or reports on them (`PHA-03`, `PAR-03`). Never write to them directly (`PEX-04`).
- `Process_Status` has no "active with errors" value: find failing instances through **activity** status (Error) or Service Center.
- **Process entity** (process property **Expose Process Entity = Yes**; automatic for public processes): one row per instance with `Process_Id`, `Label`, `Is_Suspended`, `Created` **plus the process input parameters**. Another reason inputs must be ids only (`PDS-02`). Code Quality asks for descriptions on public process entities (`PNM-05`). Light processes require Expose Process Entity = **No**.
- Entity property **Expose Process Events**: lets other modules' processes Launch On / wait on the entity's events (it deploys an event table and trigger). Enable only on designed event entities (`PAR-05`).

## 4. App types

| App type | BPT support | What changes |
|---|---|---|
| Traditional Web | Full, including the **Taskbox** and human activity **Destination** | Still prefer the task entity for SLAs and reporting |
| Reactive Web | Processes, activities, waits, Light BPT. Human activity **Destination to Reactive screens from Platform Server 11.8** (community-confirmed; a "Using Taskbox in Reactive Web Apps" how-to and a Sample Reactive Taskbox exist) | Below 11.8: no Destination — navigate from your own inbox. Any version: build the inbox on the task entity (`PHA-03`, `PHA-08`) |
| Mobile | Same server side; Destination to mobile screens is not the pattern | Inbox through BL; offline completion must be queued and re-validated on sync |
| **Service modules** | Processes and automatic activities | **No Human Activities** — host human-task processes in a module type that supports UI (`PAR-09`) |

## 5. Engine facts and defaults

| Fact | Value | Source | Consequence |
|---|---|---|---|
| Regular BPT threads per front-end | 10 by default *(verify)* | MVP/community | Bursts queue; long steps starve others (`POP-02`). A process in a wait or human step holds no thread |
| Light BPT threads per front-end | 20 by default, separate pool *(verify)* | MVP/community | Higher throughput; on-premises the count is configurable, but more than ~20 can bottleneck the database |
| Timer threads per front-end | about 3 *(verify)* | community | Heavy timers compete with each other |
| Automatic activity timeout | about 5 min *(verify)* | MVP | Keep steps short (`PAA-02`) |
| Light BPT timeout | about 3 min, reported not configurable *(verify)* | MVP | Handlers must be very short (`PLT-04`) |
| Failed automatic activity | **retried until it succeeds or the process is terminated**; no platform cap *(verify)* | Champion/MVP 2025 | Bound retries yourself (`PAA-06`) |
| Failed Light BPT handler | event `Error_Count` + 1, `Next_Run` postponed with growing backoff up to about once a day; success deletes the event row *(verify)* | community | Opaque, unbounded: track failures on your own event row (`PLT-03`) |
| Session in activities | none; session variables at defaults; `GetUserId()` is not the requester | official (timers/BPT) | `PAA-03` |
| Launch timing | after the launching transaction commits; on **Oracle/DB2 commit before launching** | official | `PAR-04` |
| Light process requirements | Start → one Automatic Activity → End; Launch On a database (Create) event; Expose Process Entity = No; module has **Light process execution** ticked in Service Center (Operation tab) and is republished; .NET Platform Server with SQL Server or Oracle | official | `PLT-01` |
| Light process limits | no process/activity instances or history; callbacks (e.g. On Process Start) skipped; no output parameters; no start dates on automatic activities; no ordering guarantee | official + community | `PLT-*` |
| Due date on a human activity | informational: a passed due date does **not** close the activity or fire On Close | community | SLAs are modeled (`PDS-04`) |
| Republish with live instances | instances are **upgraded**; the impact analysis **suspends** those it cannot upgrade (§7) | official | `PVR-*` |
| Runtime data | process and activity rows kept until deleted; no automatic cleanup | official + community | `POP-01` |

## 6. Operations tooling

| Tool | Who | Use |
|---|---|---|
| Service Center → Monitoring → Processes; process and module pages | OutSystems | Instance status, errors, retry; Operation tab for Light process execution; **Impact Analysis (preview)** on upload |
| **BPT Governor** (Forge, by OutSystems Global Support) | OutSystems Support | Process/activity count tracking, threshold alarms by email, retention-based cleanup of closed instances through the BPT API, bulk terminate active / bulk delete closed instances; weekly timers; admin role or LifeTime Full Control |
| BPT Utils (Forge, community) | Community | Process list, bulk/single terminate (warns that terminating can corrupt data depending on process logic), delete logged data of closed instances before a date |
| Business Activity Monitoring (Forge) | Community | Finding active instances per activity before changing a process |

Use them through change control: bulk terminate and delete are irreversible (`PEX-05`).

## 7. Process upgrade (official behaviour)

On publish, executing instances are upgraded to the new flow. An **impact analysis** runs on every deployment (Service Studio, Service Center, LifeTime) — **Effective** mode — and either upgrades or **suspends** each instance. **Preview** mode runs the same analysis without touching instances: upload the application in Service Center and run Impact Analysis.

| Change | Instance position | Result |
|---|---|---|
| Activity added | anywhere | continues |
| Activity deleted | **in** the deleted activity | **suspended** |
| Activity deleted | before it | runs the new flow without it |
| Activity deleted | after it | continues |
| Activity moved | would need to run it again / should have run it | **suspended** |
| Activity output parameters changed | executed that activity, not yet the one using the outputs | **suspended** (unless the type converts automatically) |
| Process input/output parameters changed | callers running it via Execute Process | **suspended** (unless auto-convertible) |

Suspended instances must be reviewed in Service Center: resume or terminate. Official workaround for removing activities safely: a Decision with **Deprecated** and **New** branches that always returns New; move the old activities to Deprecated; delete them once no instance sits there. Full procedure: `operations-and-versioning.md` §5.

## 8. ODC

ODC does not run O11 BPT. It offers **Workflows** built in the Workflow Editor: human activities assignable to users or **public roles**, automatic activities, decisions, **Wait**, **Conditional Start**, **Terminate**, **SLAs**, and a revision history of published versions. Apps launch them from events or actions. This skill's principles apply (mechanism choice, ids-only data, thin steps calling app or library logic, a task view for UX, server-side checks on completion, idempotency, versioning care, monitoring), but element names, limits and the assignment model differ. Check current ODC documentation before mapping any rule one-to-one.
