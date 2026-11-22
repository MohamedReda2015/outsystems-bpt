# Sources (research 2026-11)

Where the skill's platform facts come from, and how strong each source is. **Official** = OutSystems product documentation or OutSystems-published components; **mirror** = a third-party copy of the OutSystems 11 product docs (same text, unofficial host — re-verify on success.outsystems.com); **community** = forum answers (role noted), blogs, Forge components by non-OutSystems authors. Retrieved 2026-11-22.

## Official / mirror of official docs
| Topic | Source | Facts used |
|---|---|---|
| Processes overview, launching | [Official Processes source](https://github.com/OutSystems/docs-product/blob/master/src/building-apps/processes/intro.md) and [Launch Process](https://github.com/OutSystems/docs-product/blob/master/src/building-apps/processes/actions-extended/launch-process-action.md) | Launch On (Create entity action adds the entity id input), explicit launch via process extended actions, Execute Process; on Oracle/DB2 commit before launching; cycles create new activity instances |
| Process extended actions | Mirror: `.../processes/actions-extended/intro/` | `Launch<Process>` (output Id), `Close<HumanActivity>`, `Close<Wait>`, `Start<ConditionalStart>` |
| Close human activity | Mirror: `.../actions-extended/close-human-activity-action/` | `Close<HumanActivity>(ActivityId, outputs…)`; ActivityId from the runtime property `ActivityId` |
| Light processes | Mirror: `.../processes/light-process/`; official product update "Core business processes – scalable database queueing" (outsystems.com/product-updates) | Start → Automatic Activity → End; database-event launch; Expose Process Entity = No; enable "Light process execution" in Service Center → module → Operation tab, then republish; no process/activity instances or history; no start dates on automatic activities; .NET with SQL Server/Oracle |
| Process upgrade / impact analysis | Mirror: `.../process-upgrade/intro/`, `impact-delete-activities/`, `impact-add-activities/`, `impact-move-activities/`, `impact-change-parameters/` | Instances are upgraded on publish; impact analysis upgrades or **suspends**; Effective vs **Preview** mode (upload in Service Center → Impact Analysis); deleted/moved activity cases suspend; changed activity outputs / sub-process parameters suspend unless auto-convertible; additions are safe; Deprecated/New Decision workaround |
| Process entities | Mirror: `.../process-entities/intro/`, `process-entities-attributes/` | Expose Process Entity = Yes → one row per instance: `Process_Id`, `Label`, `Is_Suspended`, `Created` + input parameters |
| Exceptions in callbacks | Mirror: `.../logic/exceptions/intro/` | Abort Activity Change Exception in activity callbacks prevents the activity from advancing |
| BPT Governor | Forge 17901, published by **OutSystems Global Support**, v1.1.23 (2024-04), O11 | Process/activity count tracking, threshold alarms, retention-based cleanup of closed instances via the BPT API, bulk terminate active / bulk delete closed; weekly timers; tracker retention default 1095 days |
| Architecture integration patterns | OutSystems App Architecture docs (integration patterns for core services abstraction) | Inbound queue → cluster pattern for ordered event handling |
| ODC Workflows | OutSystems product updates: "Workflows – new language elements and public roles", "ODC workflows SLAs", "ODC workflow revision history" | Human activities assigned to users or public roles; Wait, Conditional Start, Terminate; SLAs; revision history in the Workflow Editor |

## Community
| Topic | Source | Facts used |
|---|---|---|
| Light BPT internals | Forum 41063 "Light processes under the hood" (user; MVP reply) | 20 Light threads vs 10 BPT per front-end; Light timeout ~3 min, BPT automatic activity ~5 min (MVP); unhandled exception → `Error_Count`+1, `Next_Run` postponed with backoff up to about once a day; success deletes the event row; only Create launches; use a business-event entity for updates; callbacks skipped; no output parameters |
| Threads | Forum 88217, forum 41063 (Champion) | ~3 timer threads per front-end by default; thread counts configurable on-premises (Configuration Tool); raising above 20 can bottleneck the database |
| Retry of automatic activities | Forum 105130 (Champion, MVP, Dec 2025) | Failed automatic activities retry until success or termination; no official retry cap; counter workaround; `ProcessTerminate` for unrecoverable errors; `ActivityClose` closes human activities only |
| Reactive Destination / Taskbox | Forge 8355 "Sample Reactive Taskbox" (2021); forum 65482 | Human activity Destination for Reactive screens from **Platform Server 11.8**; "Using Taskbox in Reactive Web Apps" how-to |
| UI/activity sync | Forum 72949 (**OutSystems staff**, 2022) | Entity-event closes are asynchronous; call `Close<HumanActivity>` or `ActivityClose` from logic for synchronous progress |
| Due dates | Forum 64314 | A passed due date does not close the activity or fire On Close |
| On Ready closing | Forum 18208 | Closing an activity inside its own On Ready appears to hang |
| Expose Process Events | Forum 63896 | Ticked entities appear in Launch On; event table + trigger on Create |
| Deployments and suspended instances | Forum 60894 (MVP, staff) | Reports of suspended instances resuming after redeploy; not reproduced by staff; no confirmed rule |
| Light BPT ordering | Forum 101814 (MVP, solution) | No ordering guarantee; inbound queue → cluster trick |
| Service modules | Forum 84446 | Human Activity not available in Service modules (needs UI) |
| Error status | Forum 100518 | `Process_Status` has no "Active with errors"; derive errors from activity status |
| BPT Utils | Forge 1313 (community, v4.0.0, 2021) | Process list, bulk/single terminate (warns of data corruption depending on logic), delete logged info of closed instances before a date |
| Group assignment patterns | Forums 25435, 6311; Forge 13046, 7360, 13970 | One-of-group vs all-of-group patterns; custom taskbox for non-user assignment |
| Async patterns | Forum 85146, 73927, 87230; Packt "Rapid Application Development with OutSystems" ch. 15 | BPT to orchestrate, timers for batches; keep heavy work out of automatic activities |
| Data growth | Forum 27397; Ideas 10826; OutSystems best-practices "archive" (GitHub OutSystems/docs-bestpractices) | No automatic BPT cleanup; activity table growth slows queries; plan archiving |

Unreachable during research (HTTP 403): two itnext.io articles on BPT monitoring and asynchronous processes, and a Medium article on Light processes. Their key points were covered by the forum thread above.


## Reliability review — 2026-11-22

See [verification and reliability](../references/verification-and-reliability.md) for primary sources, provenance and acceptance cases. Platform facts are separated from house policy and anonymized project observations. A community mirror is not an official publication; installed contracts and version-matched official sources take precedence. Runtime claims were not retested in a live tenant during this documentation review.
