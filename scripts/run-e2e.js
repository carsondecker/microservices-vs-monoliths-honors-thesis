const path = require("node:path");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const env = process.env;
const target = env.TARGET || "monolith";
if (!["monolith", "microservices"].includes(target))
  throw Error("Invalid TARGET");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status || 1);
}
const dir =
  env.RESULTS_DIR && env.RUN_NAME
    ? path.join(env.RESULTS_DIR, env.RUN_NAME)
    : `results/${target}-${Date.now()}`;

fs.mkdirSync(dir, { recursive: true });

run("docker", ["compose", "down", "-v", "--remove-orphans"]);
run("docker", ["compose", "up", "-d", "--wait", "db"]);

const services =
  target === "monolith"
    ? ["monolith", "monolith-gateway"]
    : [
        "product-service",
        "order-service",
        "payment-service",
        "pricing-service",
        "microservices-gateway",
      ];

run("docker", ["compose", "up", "-d", "--build", "--wait", ...services]);

const result = spawnSync(
  "k6",
  [
    "run",
    `--summary-export=${dir}/summary.json`,
    "tests/e2e.js",
  ],
  { encoding: "utf8", env }
);

fs.writeFileSync(
  dir + "/output.txt",
  (result.stdout || "") + (result.stderr || ""),
);
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
if (result.status !== 0) process.exit(result.status || 1);

console.log(`Results: ${dir}`);
