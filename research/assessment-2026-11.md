# Assessment of outsystems-bpt v1.0.0 against research (2026-11-22)

Method: official OutSystems 11 process documentation (via a mirror of the product docs, flagged for re-verification), OutSystems product updates, OutSystems Global Support's BPT Governor, community forum answers by staff, MVPs and Champions, Forge components and books. Sources and their strength: `sources.md`. Result: v1.1.0.

## 1. What v1.0.0 got right (confirmed)
- Mechanism choice: BPT to orchestrate, timers for batches, Light BPT for background single steps — matches MVP and staff guidance.
- Thread and timeout orders of magnitude (10 BPT / 20 Light threads per front-end; ~5 min / ~3 min) — confirmed by MVP answers.
- Only Create events launch Light processes; use a business-event entity for updates — confirmed; matches `PLT-02`.
- Light BPT keeps no process/activity history — confirmed (official).
- No automatic BPT data cleanup; growth hurts — confirmed; OutSystems Global Support ships a maintenance component.
- Due dates don't act by themselves — confirmed (a passed due date does not close the activity); SLA must be modeled (`PDS-04`).
- Ordering is not guaranteed in Light BPT — confirmed; official integration patterns use an inbound queue → cluster.

## 2. Errors and gaps found, and the fix

| # | Finding | Severity | Fix in v1.1.0 |
|---|---|---|---|
| G1 | v1.0 said Reactive/Mobile have **no Destination**. Destination for Reactive screens exists from **Platform Server 11.8**; a Reactive Taskbox how-to exists. | Error | Platform reference §4, SKILL.md Step 0, `human-activities-and-tasks.md`, `PHA-08` reworded; checker flags Destination only below 11.8. The task entity stays the house standard, for SLAs, history after purge and fast inboxes. |
| G2 | Failed automatic activities **retry until success or termination**, with no platform cap. v1.0's "re-raise so it goes to Error" creates infinite retries. | Error | `PAA-05` and a new `PAA-06`: bounded attempts. The handler records the attempt and commits it, then re-raises below the limit; at the limit it routes to a handled failure branch or terminates. |
| G3 | Light BPT **retries automatically with backoff** (up to about once a day) on unhandled exceptions, and deletes the event row on success. v1.0 did not explain this. | Gap | Light BPT section: why the house pattern records failure on its own event row (visibility, bounded, own backoff) instead of relying on the opaque platform retry. |
| G4 | Light execution is **enabled per module in Service Center** (Operation tab, then republish). It also requires **Expose Process Entity = No**, is .NET + SQL Server/Oracle only, and a manual `Launch<Process>` runs it as a **regular** process. No callbacks, outputs or start dates. | Gap | Platform reference and `PLT-01`; checker validates Expose Process Entity and launch type. |
| G5 | Process upgrade: instances are **auto-upgraded**, and the impact analysis **suspends** (not errors) instances on deleted or moved activities and on changed activity outputs or sub-process parameters. A **Preview** impact analysis exists in Service Center, plus an official Deprecated/New Decision workaround. | Error / gap | `operations-and-versioning.md` §5 rewritten; new `PVR-06` (preview impact analysis), `PVR-07` (review suspended instances after deploy); `PLL-13` corrected ("suspended"). |
| G6 | Closing activities through **entity events is asynchronous**; staff recommend `Close<HumanActivity>`/`ActivityClose` from logic for a synchronous move. | Gap | `PHA-04` text; new `PHA-10`. |
| G7 | **Human Activities are not available in Service modules.** A house BL built as a Service module cannot host human-task processes. | Gap (placement) | New `PAR-09`; checker flags human activities in `moduleType: service`. |
| G8 | Extended actions `Close<Wait>`, `Start<ConditionalStart>`; the **Abort Activity Change** exception in callbacks; closing inside its own On Ready hangs; commit before launch on Oracle/DB2. | Gap | Platform reference §2; `human-activities-and-tasks.md` §2; process-design §2. |
| G9 | Process entities (Expose Process Entity) and their attributes (`Is_Suspended`…); public processes expose them automatically (Code Quality then asks for descriptions). | Gap | Platform reference §3; `PNM-05`; `PDS-02` reinforced (inputs are stored in the process entity). |
| G10 | Supported tooling: **BPT Governor** (OutSystems Global Support) for tracking, alarms, retention cleanup and bulk operations; BPT Utils (community; bulk terminate can corrupt data); BAM for active instances. `Process_Status` has no "active with errors". | Gap | `operations-and-versioning.md` §2, §4, §6; `POP-01`; new `PEX-05` (bulk terminate only with impact review). |
| G11 | Group assignment patterns (one-of-group vs all-of-group) are a common community question. | Gap | `human-activities-and-tasks.md` §3. |
| G12 | ODC Workflows now have role-based human activities, Wait, Conditional Start, Terminate, SLAs and revision history. | Gap | Platform reference §6. |
| G13 | The new companion skill `outsystems-cmf` (Case Management Framework, built on BPT) appeared. | Gap | "Where this skill sits" table and metadata. |

## 3. Remaining uncertainty (marked *(verify)* in the skill)
- Exact Light and BPT timeouts and their configurability on each Platform Server version (community figures).
- Whether a redeploy can resume suspended instances (one report, not reproduced by staff).
- Exact names and signatures of System/BPT_API actions (`ActivityRetry`, `Process_Delete`…) — read them in Service Studio.
- The mirror host for the product docs: re-verify on success.outsystems.com when it is reachable.

## 4. Recommendations for teams (summary)
1. Turn on bounded retries for every automatic activity; infinite platform retries hide failures.
2. Install and schedule BPT Governor (or an equivalent) on every environment with processes, with retention agreed with compliance.
3. Run the preview impact analysis before every deployment that changes a process; review suspended instances after it.
4. Close human activities synchronously from the completion use case.
5. Keep processes with human activities out of Service modules.
6. Use Light BPT on a business-event entity, enabled in Service Center, with your own failure tracking.
