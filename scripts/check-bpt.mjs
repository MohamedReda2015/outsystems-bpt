#!/usr/bin/env node
// OutSystems BPT process-inventory checker (Node.js 16+, no packages).
//
//   node scripts/check-bpt.mjs <inventory.json> [--json]
//
// Exit code: 0 = no Blocker/Major findings, 1 = at least one Blocker/Major, 2 = bad input.
//
// The inventory is a hand-written or exported (e.g. Service Studio MCP read tools) description of
// the processes. Unknown fields are ignored; missing optional fields skip the related checks.
//
// {
//   "appType": "reactive" | "mobile" | "traditional",
//   "platformServer": "11.31.0",            // optional; enables version-dependent checks (Destination needs 11.8+)
//   "processes": [{
//     "name": "RequestApproval",            "module": "Requests_BL",       "description": "…",
//     "moduleType": "reactive" | "service" | "traditional" | "blank",   // optional
//     "light": false,                       // Light BPT (light process execution)
//     "lightExecutionEnabled": true,        // Light only: module setting ticked in every environment
//     "exposeProcessEntity": false,
//     "launch": { "type": "explicit" | "entityEvent", "entity": "Request", "eventEntity": false },
//     "inputs":    [{ "name": "RequestId", "type": "Request Identifier", "description": "…" }],
//     "variables": [{ "name": "ReworkCount", "type": "Integer", "description": "…" }],
//     "hasCancelPath": true,                // modeled cancel (Conditional Start / Wait on cancel event)
//     "usesProcessTerminate": false,        // ProcessTerminate called from process or app logic (not admin)
//     "activities": [
//       { "type": "human", "name": "ReviewRequest", "description": "…",
//         "assignment": "role" | "group" | "user" | "none", "sla": "config" | "literal" | null,
//         "usesDestination": false, "callsBl": ["Task_CreateForActivity_Logic"], "inlineData": false, "nodes": 3,
//         "closedBy": "closeAction" | "entityEvent", "pendingProgressHandled": true, "closesInOnReady": false },
//       { "type": "automatic", "name": "NotifyRequester", "description": "…",
//         "callsBl": ["Request_NotifyRequester_Logic"], "inlineData": false, "nodes": 4,
//         "longRunning": false, "boundedRetry": true,
//         "handlers": [{ "type": "AllExceptions", "empty": false, "reraise": true }] },
//       { "type": "wait", "name": "WaitForReply", "description": "…", "timeout": "config" | "literal" | null },
//       { "type": "decision", "name": "ReviewOutcome", "description": "…", "branches": ["Approved", "Rejected", "Otherwise"] },
//       { "type": "conditionalStart", "name": "OnRequestCancelled", "description": "…" },
//       { "type": "executeProcess", "name": "RunPayment", "description": "…" },
//       { "type": "start" }, { "type": "end" }, { "type": "comment" }
//     ]
//   }]
// }
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: node scripts/check-bpt.mjs <inventory.json> [--json]");
  process.exit(2);
}
let inv;
try {
  inv = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error(`cannot read ${file}: ${e.message}`);
  process.exit(2);
}
if (!Array.isArray(inv.processes)) {
  console.error("inventory must have a 'processes' array");
  process.exit(2);
}

const findings = [];
const add = (rule, severity, where, message) => findings.push({ rule, severity, where, message });

const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const DEFAULT_NAME = /^(HumanActivity|AutomaticActivity|Wait|Decision|ConditionalStart|ExecuteProcess|SendEmail|Process|Activity|Step)\d*$/;
const BAD_INPUT_TYPE = /(record|list|binary|structure)/i;
const NON_FLOW = new Set(["start", "end", "comment"]);
const appType = (inv.appType || "").toLowerCase();
const psVersion = String(inv.platformServer || "").split(".").map((n) => parseInt(n, 10));
const psBelow = (maj, min) => psVersion.length >= 2 && !isNaN(psVersion[1]) && (psVersion[0] < maj || (psVersion[0] === maj && psVersion[1] < min));

const suffixOf = (m) => ((m || "").match(/_([A-Za-z]+)$/) || [])[1] || "";

for (const p of inv.processes) {
  const pn = p.name || "<unnamed>";
  const at = (a) => `${p.module || "?"}.${pn}${a ? "." + (a.name || a.type) : ""}`;
  const acts = Array.isArray(p.activities) ? p.activities : [];
  const flow = acts.filter((a) => !NON_FLOW.has(a.type));
  const humans = flow.filter((a) => a.type === "human");
  const autos = flow.filter((a) => a.type === "automatic");
  const waits = flow.filter((a) => a.type === "wait");

  // PAR-01 placement
  const sfx = suffixOf(p.module);
  const allowed = p.light ? ["BL", "BPT", "WF", "Sync", "Eng"] : ["BL", "BPT", "WF"];
  if (!allowed.includes(sfx))
    add("PAR-01", "Major", at(), `process lives in '${p.module || "?"}'; expected a module ending in ${allowed.map((s) => "_" + s).join(", ")}`);

  // PAR-09 human activities are not available in Service modules
  if ((p.moduleType || "").toLowerCase() === "service" && humans.length)
    add("PAR-09", "Blocker", at(), "human activities in a Service module (not supported there); move the process to a module type that supports UI");

  // PAR-04 / PLT-02 launch
  const launch = p.launch || {};
  if (launch.type === "entityEvent" && launch.eventEntity !== true) {
    if (p.light)
      add("PLT-02", "Major", at(), `Light BPT triggered by Create of '${launch.entity || "?"}', which is not a dedicated event entity`);
    else
      add("PAR-04", "Major", at(), `launched on Create of business entity '${launch.entity || "?"}'; launch explicitly from the BL use case or use a dedicated event entity`);
  }

  // PLT-01 Light shape
  if (p.light) {
    const shapeOk = flow.length === 1 && autos.length === 1;
    if (!shapeOk) add("PLT-01", "Major", at(), `Light BPT must be Start → one Automatic Activity → End (found ${flow.length} flow element(s))`);
    if (launch.type && launch.type !== "entityEvent") add("PLT-01", "Major", at(), "Light BPT must be launched by an entity Create event (Launch<Process> runs it as regular BPT)");
    if (p.exposeProcessEntity === true) add("PLT-01", "Major", at(), "Light BPT requires Expose Process Entity = No");
    if (p.lightExecutionEnabled === false) add("PLT-01", "Major", at(), "'Light process execution' is not enabled on the module; it will run as regular BPT");
  } else if (flow.length === 1 && autos.length === 1) {
    // PDS-01 single automatic activity as regular BPT
    add("PDS-01", "Major", at(), "regular BPT process with a single automatic activity; use Light BPT, an outbox or a timer, or document why");
  }

  // PDS-02 inputs
  for (const i of p.inputs || []) {
    if (BAD_INPUT_TYPE.test(i.type || ""))
      add("PDS-02", "Major", `${at()}.${i.name}`, `input of type '${i.type}'; pass identifiers only and read current state in each step`);
    if (!i.description) add("PNM-05", "Minor", `${at()}.${i.name}`, "input has no Description");
  }
  for (const v of p.variables || []) {
    if (BAD_INPUT_TYPE.test(v.type || ""))
      add("PDS-02", "Major", `${at()}.${v.name}`, `process variable of type '${v.type}'; keep ids and outcomes only`);
  }

  // PDS-05 cancellation
  if (!p.light && (humans.length || waits.length) && p.hasCancelPath === false)
    add("PDS-05", "Major", at(), "long-lived process (human activity or wait) without a modeled cancel path");
  if (p.usesProcessTerminate === true)
    add("PDS-05", "Major", at(), "ProcessTerminate used outside the admin back office; model cancellation with cleanup");

  // PDS-07 size
  if (flow.length > 15) add("PDS-07", "Minor", at(), `${flow.length} activities; extract sub-processes (aim ≤ 15)`);

  // PNM-01 process name
  if (!PASCAL.test(pn) || DEFAULT_NAME.test(pn)) add("PNM-01", "Minor", at(), `process name '${pn}' is not a meaningful PascalCase name`);
  else if (p.light && !pn.startsWith("Handle")) add("PNM-01", "Minor", at(), `Light BPT process should be named Handle<EventEntity>`);
  if (!p.description) add("PNM-05", "Minor", at(), "process has no Description");

  for (const a of flow) {
    const w = at(a);
    if (!a.name) add("PNM-02", "Minor", w, `${a.type} has no name`);
    else if (DEFAULT_NAME.test(a.name)) add("PNM-02", "Minor", w, `default name '${a.name}'`);
    else if (!PASCAL.test(a.name)) add("PNM-02", "Minor", w, `'${a.name}' is not PascalCase`);
    if (!a.description) add("PNM-05", "Minor", w, "no Description");

    // PAR-02 thin activities
    if (a.type === "automatic" || a.type === "human") {
      if (a.inlineData === true) add("PAR-02", "Major", w, "aggregates, SQL or integration calls drawn inside the process; move to a BL _Logic action");
      if (Array.isArray(a.callsBl) && a.callsBl.length > 1)
        add("PAR-02", "Major", w, `calls ${a.callsBl.length} BL actions; call one step action that composes them`);
      if (typeof a.nodes === "number" && a.nodes > 8) add("PAR-02", "Major", w, `${a.nodes} nodes in the activity logic; keep it thin (≤ 8)`);
    }

    if (a.type === "human") {
      if (a.assignment === "user" || a.assignment === "none")
        add("PHA-02", "Major", w, `assignment '${a.assignment}'; assign to a role/group resolved in BL with a fallback group`);
      if (a.sla === null || a.sla === undefined) {
        if ("sla" in a) add("PDS-04", "Major", w, "human activity without SLA / escalation");
      } else if (a.sla === "literal") add("POP-04", "Major", w, "SLA duration is a literal; read it from configuration");
      if (a.usesDestination === true && (appType === "mobile" || (appType === "reactive" && psBelow(11, 8))))
        add("PHA-08", "Major", w, `uses activity Destination, unavailable for ${appType === "mobile" ? "Mobile screens" : "Reactive below Platform Server 11.8"}; navigate from the task-entity inbox`);
      if (a.closedBy === "entityEvent" && a.pendingProgressHandled !== true)
        add("PHA-10", "Major", w, "entity-event closure is asynchronous; document pending progression in the UI or use an explicit close with verified semantics");
      if (a.closesInOnReady === true) add("PHA-10", "Major", w, "activity is closed inside its own On Ready");
    }

    if (a.type === "automatic") {
      if (a.longRunning === true) add("PAA-02", "Major", w, "long-running work in an activity; enqueue a job and Wait for its completion");
      if (!p.light && a.boundedRetry === false)
        add("PAA-06", "Major", w, "no attempt limit; the platform retries failed automatic activities until success or termination");
      for (const h of a.handlers || []) {
        if (h.empty === true) add("PAA-05", "Major", w, `empty ${h.type || "exception"} handler`);
        else if (!p.light && h.type === "AllExceptions" && h.reraise === false)
          add("PAA-05", "Major", w, "AllExceptions handled without re-raise; the process continues as if the step succeeded");
      }
    }

    if (a.type === "wait") {
      if ("timeout" in a && (a.timeout === null || a.timeout === undefined || a.timeout === false))
        add("PDS-04", "Major", w, "Wait without a timeout and timeout branch");
      else if (a.timeout === "literal") add("POP-04", "Major", w, "Wait timeout is a literal; read it from configuration");
      if (a.name && !DEFAULT_NAME.test(a.name) && !a.name.startsWith("WaitFor")) add("PNM-03", "Minor", w, "Wait should be named WaitFor<Event>");
    }

    if (a.type === "conditionalStart" && a.name && !DEFAULT_NAME.test(a.name) && !/^On[A-Z]/.test(a.name))
      add("PNM-03", "Minor", w, "Conditional Start should be named On<Event>");

    if (a.type === "decision" && Array.isArray(a.branches)) {
      if (a.branches.some((b) => /^(true|false)$/i.test(b))) add("PNM-03", "Minor", w, "branches labelled True/False; label them with business outcomes");
      if (!a.branches.some((b) => /^(otherwise|else|default|other)$/i.test(b)))
        add("PDS-03", "Major", w, "Decision has no 'Otherwise' branch to a handled path");
    }
  }
}

const order = { Blocker: 0, Major: 1, Minor: 2 };
findings.sort((x, y) => order[x.severity] - order[y.severity] || (x.rule < y.rule ? -1 : x.rule > y.rule ? 1 : 0) || (x.where < y.where ? -1 : x.where > y.where ? 1 : 0));
const failing = findings.filter((f) => f.severity !== "Minor").length;

if (asJson) {
  console.log(JSON.stringify({ processes: inv.processes.length, findings }, null, 2));
} else {
  for (const f of findings) console.log(`${f.severity.padEnd(7)} ${f.rule}  ${f.where}: ${f.message}`);
  const c = (s) => findings.filter((f) => f.severity === s).length;
  console.log(`${inv.processes.length} process(es) checked: ${c("Blocker")} blocker, ${c("Major")} major, ${c("Minor")} minor`);
}
process.exit(failing ? 1 : 0);
