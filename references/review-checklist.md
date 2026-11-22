# Review checklist (enforceable BPT rules)

Every rule has an ID, a severity and a check. Cite the ID in findings. IDs stay stable between versions: new rules get new numbers. Rules from the companion skills (`ARC-*`, `HSE-*`, `SEC-*`, `BLG-*`, `BTX-*`, `FET-*` …) are cited, not redefined.

**Severity**: **Blocker** — security hole or production incident waiting to happen; fix before release. **Major** — real risk or cost; fix this release. **Minor** — convention or hygiene; fix when you touch it.

**Tags**: `[auto]` = checked by `scripts/check-bpt.mjs` on an inventory.

## PAR — Placement and architecture
| ID | Sev | Rule | Check / fix |
|---|---|---|---|
| PAR-01 | Major | Processes live in Core: `<App>_BL` (folder `Processes`) or a `<Concept>_BPT` sublayer; Light BPT handlers may also live in `_Sync`/`_Eng`. Never in Front-End, CW, CS, IS, Lib or theme `[auto]` | Move the process down/up to BL or `_BPT` |
| PAR-02 | Major | Activities are thin: each automatic activity/callback calls one BL action and maps outputs; no aggregates, SQL, integrations or rule trees in the process `[auto]` | Extract to `<Concept>_<Step>_Logic` |
| PAR-03 | Major | Business status in the CS entity is the source of truth, changed by BL transitions with history; UI and reports never derive status from platform process tables | Add status transitions per step |
| PAR-04 | Major | Launch explicitly with `Launch<Process>` from a BL use-case action after authorization; entity-event launch only on a dedicated event/queue entity `[auto]` | Move the launch into the use case; add an event entity |
| PAR-05 | Major | Other apps never launch, close or terminate your processes directly; they call your Service Action or API; Expose Process Events only on designed event entities | Add a Service Action entry point |
| PAR-06 | Minor | Split a `<Concept>_BPT` sublayer above BL when processes are many/large, change on another cadence or are shared by several apps | Split; BL never references `_BPT` |
| PAR-07 | Major | Activities reach external systems only via BL step logic → `<Concept>_IS`, explicit timeout (`INT-01`, `BIN-02`) | Wrap the call |
| PAR-08 | Major | Task UI follows the house chain: FE screens compose CW task blocks; CW calls BL task actions (`HSE-03`) | Move logic to BL/CW |
| PAR-09 | Blocker | Processes with Human Activities are not placed in Service modules (human activities need UI and are unavailable there) `[auto]` | Move to a `_BPT` (or BL) module of a supporting type |

## PDS — Process design
| ID | Sev | Rule | Check / fix |
|---|---|---|---|
| PDS-01 | Major | The mechanism (BPT, Light BPT, timer, outbox, status-only) is chosen with the decision table and recorded in the spec; a single-automatic-activity BPT process is flagged `[auto]` | Switch to Light BPT/outbox/timer, or document why |
| PDS-02 | Major | Process inputs are identifiers plus small immutable context; no records, lists, binaries or data-carrying Structures; steps read current state `[auto]` | Replace with ids |
| PDS-03 | Major | Every Decision covers all outcomes with labelled branches including "otherwise"; every path reaches an End `[auto]` | Add the missing branch |
| PDS-04 | Major | Every Wait has a timeout with a modeled branch; every human activity has an SLA (`DueOn`) and an escalation path `[auto]` | Add timeout/SLA from config |
| PDS-05 | Major | Cancellation is modeled (event → cleanup → End); `ProcessTerminate` only from the admin back office `[auto]` | Add a cancel path |
| PDS-06 | Major | Loops carry a counter and a configured limit | Add counter + limit branch |
| PDS-07 | Minor | Readable diagrams: top-down, labelled branches, comments on Decisions/Waits, ≤ about 15 activities, sub-processes for reuse `[auto]` | Refactor layout; extract sub-process |
| PDS-08 | Major | One active process per workflow per record: duplicate guard in the launching transaction | Guard + lock or unique index |
| PDS-09 | Minor | `ProcessId` stored on the business record or task row | Add the column |
| PDS-10 | Major | Parallel work uses per-approver tasks or child processes plus a Wait on "all done"; never polling loops | Remodel |

## PHA — Human activities and tasks
| ID | Sev | Rule | Check / fix |
|---|---|---|---|
| PHA-01 | Blocker | Completing a task re-checks on the server: current user is the assignee (or holds the assigned role/group and it is unclaimed), task open, outcome valid, record in the expected state; ids from the client are only pointers (`SEC-01`, `SEC-09`) | Add the checks to the BL completion action |
| PHA-02 | Major | Assignment by role/group resolved in BL, with segregation of duties and a fallback group; no hard-coded users `[auto]` | Move to `<Concept>_GetAssignees_Logic` + config |
| PHA-03 | Major | Every human activity is mirrored in an `<App>Task` row (CS) created in On Ready and closed on completion; inbox/SLA/reports read it, not `Activity` tables | Add the task entity and sync |
| PHA-04 | Major | One BL use-case action per task outcome/type writes outcome/history and closes the activity under a verified commit plan, returning `ActionResult` | Replace generic "close activity" calls |
| PHA-05 | Major | Group tasks are claimed before completion; completion uses a row lock or optimistic check so only one completion wins | Add claim + lock |
| PHA-06 | Major | Notifications from task callbacks go through an outbox; they never fail the activity (`BTX-06`) | Write an outbox row instead of sending |
| PHA-07 | Major | Reassignment and delegation only via role-checked, audited BL actions | Add `Task_Reassign` with audit |
| PHA-08 | Major | The inbox is built on the task entity, never on the Taskbox or platform activity tables; Destination is used only on Platform Server 11.8+ (Reactive) and only as navigation to an FE task screen that authorizes through BL `[auto]` | Build inbox + task screens; remove Destination below 11.8 |
| PHA-09 | Minor | Task titles and descriptions are translatable, not concatenated in the process | Use resources / task type entity |
| PHA-10 | Major | Choose explicit close or entity-event progression deliberately; verify commit behavior and handle pending next tasks; never close inside the activity’s own On Ready `[auto]` | Call the close action in the use case |

## PAA — Automatic activities
| ID | Sev | Rule | Check / fix |
|---|---|---|---|
| PAA-01 | Major | Idempotent: check state before acting; idempotency key or lookup for external creates (`BTX-05`) | Add guards |
| PAA-02 | Major | Short (seconds); long work goes to a job/timer and the process Waits for completion `[auto]` | Split into job + Wait |
| PAA-03 | Major | No `GetUserId()` for business decisions or authorization in background steps; system user or stored actor for audit | Pass the actor; call `_Logic` |
| PAA-04 | Major | Transient failures on idempotent calls use a bounded retry path (counter + Wait timeout delay) | Add retry path |
| PAA-05 | Major | Unexpected errors are logged with correlation and re-raised so the activity goes to Error; no swallowed exceptions (`BER-02`) `[auto]` | Re-raise; remove empty handlers |
| PAA-06 | Major | Retries are bounded: the platform retries failed automatic activities until success or termination, so the handler records attempts (committed) and routes to a failure branch or terminates at a configured limit `[auto]` | Add attempt counter + limit |

## PLT — Light BPT
| ID | Sev | Rule | Check / fix |
|---|---|---|---|
| PLT-01 | Major | Light BPT for single-step, high-volume event handling with no human step or history need; process is Start → one Automatic Activity → End, launched only by a Create event (never `Launch<Process>`), Expose Process Entity = No, and **Light process execution** enabled on the module in every environment `[auto]` | Fix the shape, launch or module setting |
| PLT-02 | Major | Triggered by a dedicated event entity, not the main business entity `[auto]` | Add `<Concept>Event` |
| PLT-03 | Major | Handler is idempotent and records Processed/Failed/Dead with attempts and last error; a sweeper timer retries Failed and alerts on Dead | Add status columns + sweeper |
| PLT-04 | Major | Handler is very short; long work is enqueued as a job | Split |
| PLT-05 | Minor | A kill switch read at the start of the handler pauses processing without deployment | Add config flag |

## PEX — Errors and recovery
| ID | Sev | Rule | Check / fix |
|---|---|---|---|
| PEX-01 | Major | Failures logged once via the standard logging action with `ProcessId`, `ActivityId`, record id, attempt (`BER-03`) | Add correlation fields |
| PEX-02 | Major | A role-protected admin back office (via BL) offers retry, skip, reassign, cancel, suspend/resume and event reprocessing, each audited | Build it |
| PEX-03 | Major | Monitoring alerts on processes in Error, overdue tasks, stuck waits, event backlog and launch-rate anomalies | Add a monitoring timer + alert |
| PEX-04 | Blocker | No direct writes to platform BPT/system tables in production | Use system actions, Service Center or Support |
| PEX-05 | Major | Bulk terminate/delete of instances (BPT Governor, BPT Utils, scripts) only through change control, with the affected records listed and their business status decided | Add the change-control step |

## PVR — Versioning and deployment
| ID | Sev | Rule | Check / fix |
|---|---|---|---|
| PVR-01 | Blocker | Before publishing a changed process, live instances per activity are counted; activities with live instances are never removed, renamed or retyped, and their Wait conditions not changed incompatibly (add → drain → remove) | Restore the activity; add a new path |
| PVR-02 | Major | Process inputs and variables change backward-compatibly (add with defaults; remove only after drain) | Keep the old input |
| PVR-03 | Major | Process changes are tested against in-flight instances started on the previous version | Add the test |
| PVR-04 | Major | Deployment notes list process changes, live-instance impact, per-environment config and a forward-fix plan | Complete the notes |
| PVR-05 | Minor | Process deployments avoid business peaks and running launch bursts | Reschedule |
| PVR-06 | Major | Before deploying a process change to an environment with live instances, the Service Center Impact Analysis is run in **preview** mode and its result is in the deployment notes | Run preview, adjust the change |
| PVR-07 | Major | After every deployment that touches a process, suspended instances are reviewed and each is resumed or terminated deliberately | Add to the deployment checklist |

## POP — Operations, data and capacity
| ID | Sev | Rule | Check / fix |
|---|---|---|---|
| POP-01 | Major | Data growth plan: Light BPT for single-step volume, business history in own entities, agreed retention, scheduled cleanup of closed instances through the BPT API (e.g. BPT Governor) and of own event rows | Define retention + purge |
| POP-02 | Major | No bursts of thousands of launches (imports, migrations, bulk updates); batch via timer or Light BPT | Throttle |
| POP-03 | Minor | Heavy async load isolated (dedicated front-ends / zone) when it affects users | Plan capacity |
| POP-04 | Major | Assignees, groups, SLA durations, retry limits, delays and kill switches come from per-environment configuration, never literals `[auto]` | Move to config entity / site properties |

## PSC — Security
| ID | Sev | Rule | Check / fix |
|---|---|---|---|
| PSC-01 | Blocker | Launch, cancel, reassign, retry, skip, suspend and terminate only through BL actions with role + ownership checks; system process actions never exposed to client logic | Wrap and check |
| PSC-02 | Major | Inboxes and task details are filtered on the server by `GetUserId()`, roles/groups and tenant; outputs are summary Structures | Fix the BL query |
| PSC-03 | Major | No personal data beyond ids, and no secrets, in process inputs/variables, activity labels or logs (`SEC-06`) | Replace with ids; mask logs |

## PNM — Naming and documentation
| ID | Sev | Rule | Check / fix |
|---|---|---|---|
| PNM-01 | Minor | Process `<Concept><Workflow>`; Light BPT `Handle<EventEntity>`; English PascalCase `[auto]` | Rename |
| PNM-02 | Minor | No default element names (`HumanActivity1`, `AutomaticActivity2`, `Wait1`, `Decision1`, `ConditionalStart1`); activities `<Verb><Object>` `[auto]` | Rename |
| PNM-03 | Minor | Waits `WaitFor<Event>`, Conditional Starts `On<Event>`, Decision branches labelled with outcomes `[auto]` | Rename |
| PNM-04 | Minor | Step logic in BL named `<Concept>_<Step>_Logic`; task use cases `<Concept>_<Outcome>` | Rename |
| PNM-05 | Minor | Every process, activity, input and variable has a Description (`HSE-06`) `[auto]` | Describe |

## PLL — Lessons
`PLL-01` … `PLL-22` are defined in `lessons-learned.md`; cite them as background, not as findings.


## Reliability and evidence (2026-11 review)

These manual checks complement, rather than extend the claimed coverage of, the static scripts. Details and acceptance cases: [verification and reliability](verification-and-reliability.md).

| ID | Severity | Rule |
|---|---|---|
| PRV-01 | Major | Define owners for business, process, task and notification state, including parallel/cancel outcomes. |
| PRV-02 | Major | Check and serialize task claims/completion with an explicit transaction boundary map. |
| PRV-03 | Major | Choose retry ownership, persist attempts correctly and recover paused or stale jobs without duplicate effects. |
| PRV-04 | Major | Verify in-flight upgrade behavior and evidence for admin recovery operations. |

## Cross-skill acceptance

| ID | Severity | Rule | Check |
|---|---|---|---|
| PRV-05 | Major | Correlate business commands, process instances and activities; reject stale or wrong-instance signals. | Manual; verification-and-reliability reference. |
| PRV-06 | Major | Verify durable business and process state with bounded observation, including replay and cancellation races. | Manual; verify against the story acceptance cases. |
