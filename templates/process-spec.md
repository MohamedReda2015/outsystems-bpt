# Process spec — <ProcessName>

Owner: <team/person> · Module: <App>_BL | <Concept>_BPT · Version: <n> · Date: <yyyy-mm-dd> · Status: draft | approved

## 1. Purpose
<One paragraph: the business workflow, the record it governs, the outcome.>

## 2. Mechanism (PDS-01)
- Chosen: BPT | Light BPT | Timer | Outbox | Status-only
- Decision-table question that chose it: <#n and answer>
- Expected volume: <instances/day>, typical life: <hours/days>, peak: <...>
- Revisit when: <volume, new human step, ...>

## 3. Business state machine (PAR-03)
| From status | To status | Trigger (human / system / time / event) | Who | Activity |
|---|---|---|---|---|

## 4. Launch (PAR-04, PDS-08, PDS-09)
- Launched by: <BL use-case action> after <authorization, validation>
- Inputs (ids only, PDS-02): | Name | Type | Description |
- Duplicate guard: <how>
- `ProcessId` stored on: <entity.attribute>

## 5. Steps
| # | Element | Name | Type | BL action called | Status set | Assignee rule / event | SLA / timeout (config key) | On failure |
|---|---|---|---|---|---|---|---|---|

## 6. Human tasks (PHA-*)
| Task type | Offered to (role/group rule) | Segregation of duties | Claim needed | Outcomes | Completion action | Notification |
|---|---|---|---|---|---|---|

## 7. Unhappy paths
- Cancellation (PDS-05): <event, cleanup steps>
- Timeouts and escalation (PDS-04): <per wait/task>
- Rework limit (PDS-06): <counter, limit, then what>
- Step failures (PAA-04, PAA-05, PAA-06): <retry policy, MaxAttempts config key, failure branch>
- Light BPT only (PLT-01): event entity, Expose Process Entity = No, "Light process execution" enabled on <module> in: Dev ☐ Test ☐ Prod ☐
- No assignee found: <fallback group, alert>

## 8. Security (PSC-*)
- Roles: <who can launch, see, claim, complete, reassign, cancel, administer>
- Server-side checks per action: <...>
- Data in process variables: ids only — confirm

## 9. Configuration (POP-04)
| Key | Where (config entity / site property) | Default | Per-environment value |
|---|---|---|---|

## 10. Operations
- Monitoring and alerts (PEX-03): <...>
- Admin back-office actions (PEX-02): <...>
- Retention of runtime and own history data (POP-01): <...>

## 11. Versioning (PVR-*) — for changes to an existing process
- Live instances per affected activity at design time: <...>
- Preview Impact Analysis result in Service Center (PVR-06): <instances that would be suspended>
- Deprecated/New Decision plan for removed or moved activities: <...>
- In-flight test plan: <...>
- Post-deploy review of suspended instances (PVR-07): owner <...>

## 12. Test scenarios
Happy path · each Decision outcome · rework limit · timeout/escalation · cancel at each stage · forced step failure + retry · concurrent completion · wrong user completes · double submit · version change with in-flight instances.


## Evidence and acceptance

- Platform/app type, installed versions/theme where relevant, target environment:
- Existing project decisions and authorized delivery scope:
- Requirement → element/contract → source of data → verification evidence:
- Concurrency, retry/unknown outcome, authorization and failure cases relevant to this change:
- Delivery status: prepared / model validated / merged / published / runtime verified (record only observed stages):
- Not tested, missing dependency or blocked evidence, and the exact next step:
