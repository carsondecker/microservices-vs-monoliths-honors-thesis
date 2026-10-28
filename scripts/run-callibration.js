const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
 
const env = process.env;
const maxP95Ms = Number(env.P95_MS || 1000);
const maxErrorRate = Number(env.ERROR_RATE || 0.01);
const maxVus = Number(env.MAX_VUS || 512);
 
function passes(target, dir, vus) {
  const name = `vus-${vus}`;
  const r = spawnSync("node", [path.join(__dirname, "run-e2e.js")], {
    stdio: "ignore",
    env: {
      ...env,
      TARGET: target,
      VUS: String(vus),
      ITERATIONS: String(1000),
      RESULTS_DIR: dir,
      RUN_NAME: name,
    },
  });
 
  const file = `${dir}/${name}/summary.json`;
  if (!fs.existsSync(file)) throw Error(`${target}: run failed at ${vus} VUs (exit ${r.status})`);
 
  const { metrics } = JSON.parse(fs.readFileSync(file, "utf8"));
  const m = (n) => metrics[n]?.values ?? metrics[n] ?? {};
  const completed = m("completed_workflows").count || 0;
  const failed = m("failed_workflows").count || 0;
  const errorRate = failed / (completed + failed || 1);
 
  return (
    completed > 0 &&
    m("iteration_duration")["p(95)"] <= maxP95Ms &&
    errorRate <= maxErrorRate
  );
}
 
function calibrate(target) {
  const dir = `results/calibrate-${target}-${Date.now()}`;
  let saturated = 0;
  let limitHit = false;
  for (let vus = 1; vus <= maxVus; vus *= 2) {
    if (!passes(target, dir, vus)) {
      limitHit = true;
      break;
    }
    saturated = vus;
  }
  console.log(`${target}: ${limitHit ? "" : ">="}${saturated} VUs`);
}
 
for (const target of ["monolith", "microservices"]) calibrate(target);