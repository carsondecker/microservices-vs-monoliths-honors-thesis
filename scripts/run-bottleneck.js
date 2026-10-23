
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const env = process.env;
const target = env.TARGET || "monolith";

if (!["monolith", "microservices"].includes(target)) {
  throw new Error("Invalid TARGET");
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env,
    ...options,
  });

  if (result.error) throw result.error;

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const dir =
  env.RESULTS_DIR && env.RUN_NAME
    ? path.join(env.RESULTS_DIR, env.RUN_NAME)
    : path.join("results", `${target}-bottleneck-${Date.now()}`);

fs.mkdirSync(dir, { recursive: true });

const summaryPath = path.join(dir, "summary.json");
const outputPath = path.join(dir, "output.txt");

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

run("docker", [
  "compose",
  "up",
  "-d",
  "--build",
  "--wait",
  ...services,
]);

const result = spawnSync(
  "k6",
  [
    "run",
    `--summary-export=${summaryPath}`,
    "tests/bottleneck.js",
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    env,
  }
);

if (result.error) throw result.error;

const output = (result.stdout || "") + (result.stderr || "");

fs.writeFileSync(outputPath, output);
process.stdout.write(output);

if (result.status !== 0) {
  console.error(`Bottleneck test failed. See ${outputPath}`);
  process.exit(result.status || 1);
}

console.log(`Results: ${dir}`);
