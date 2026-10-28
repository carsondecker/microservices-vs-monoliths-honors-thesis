
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const resultsRoot = path.resolve("results");
const runNames = ["run-1", "run-2", "run-3"];

const baseline = {
  MONOLITH_REPLICAS: "1",
  MONOLITH_CPUS: "4",
  MONOLITH_MEMORY: "1G",

  PRODUCT_REPLICAS: "1",
  PRODUCT_CPUS: "1",
  PRODUCT_MEMORY: "256M",

  ORDER_REPLICAS: "1",
  ORDER_CPUS: "1",
  ORDER_MEMORY: "256M",

  PAYMENT_REPLICAS: "1",
  PAYMENT_CPUS: "1",
  PAYMENT_MEMORY: "256M",

  PRICING_REPLICAS: "1",
  PRICING_CPUS: "1",
  PRICING_MEMORY: "256M",
};

const baselineLoads = [
  { name: "low", VUS: "32", PRICING_ITERATIONS: "10" },
  { name: "medium", VUS: "96", PRICING_ITERATIONS: "10" },
  { name: "high", VUS: "160", PRICING_ITERATIONS: "10" },
];

const bottleneckLoads = [
  { name: "low", VUS: "32", PRICING_ITERATIONS: "10000" },
  { name: "medium", VUS: "96", PRICING_ITERATIONS: "10000" },
  { name: "high", VUS: "160", PRICING_ITERATIONS: "10000" },
];

const summaryHeader = [
  "name",
  "http_req_duration_p95_ms",
  "http_req_duration_avg_ms",
  "iteration_duration_p95_ms",
  "iteration_duration_avg_ms",
  "requests_per_sec",
  "throughput_workflows_per_sec",
];

const cases = [];

function csvRow(values) {
  return values
    .map((value) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    })
    .join(",");
}

function getMetric(metrics, name) {
  return metrics[name]?.values ?? metrics[name] ?? {};
}

function addCase(target, test, variant, load, scaling = {}) {
  const name = `${target}-${test}-${variant}-${load.name}`;
  const summaryName =
    `${test}-${load.name}-${target}` +
    (variant === "baseline" ? "" : `-${variant}`);

  cases.push({
    name,
    summaryName,
    script: "scripts/run-e2e.js",
    env: {
      ...baseline,
      ...load,
      ...scaling,
      TARGET: target,
    },
  });
}

function getSummaryRow(testCase, file) {
  const summary = JSON.parse(fs.readFileSync(file, "utf8"));
  const metrics = summary.metrics ?? {};

  const requests = getMetric(metrics, "http_req_duration");
  const iterations = getMetric(metrics, "iteration_duration");
  const httpRequests = getMetric(metrics, "http_reqs");
  const workflows = getMetric(metrics, "completed_workflows");

  return [
    testCase.summaryName,
    requests["p(95)"] ?? "",
    requests.avg ?? "",
    iterations["p(95)"] ?? "",
    iterations.avg ?? "",
    httpRequests.rate ?? "",
    workflows.rate ?? "",
  ];
}

// Baseline
for (const target of ["monolith", "microservices"]) {
  for (const load of baselineLoads) {
    addCase(target, "e2e", "baseline", load);
  }

  for (const load of bottleneckLoads) {
    addCase(target, "bottleneck", "baseline", load);
  }
}

// Vertical scaling
for (const target of ["monolith", "microservices"]) {
  const scaling =
    target === "monolith"
      ? {
          MONOLITH_REPLICAS: "1",
          MONOLITH_CPUS: "8",
          MONOLITH_MEMORY: "2G",
        }
      : {
          PRODUCT_REPLICAS: "1",
          PRODUCT_CPUS: "2",
          PRODUCT_MEMORY: "512M",

          ORDER_REPLICAS: "1",
          ORDER_CPUS: "2",
          ORDER_MEMORY: "512M",

          PAYMENT_REPLICAS: "1",
          PAYMENT_CPUS: "2",
          PAYMENT_MEMORY: "512M",

          PRICING_REPLICAS: "1",
          PRICING_CPUS: "2",
          PRICING_MEMORY: "512M",
        };

  for (const load of baselineLoads) {
    addCase(target, "e2e", "vertical", load, scaling);
  }
}

// Horizontal scaling
for (const target of ["monolith", "microservices"]) {
  const scaling =
    target === "monolith"
      ? {
          MONOLITH_REPLICAS: "2",
        }
      : {
          PRODUCT_REPLICAS: "2",
          ORDER_REPLICAS: "2",
          PAYMENT_REPLICAS: "2",
          PRICING_REPLICAS: "2",
        };

  for (const load of baselineLoads) {
    addCase(target, "e2e", "horizontal", load, scaling);
  }
}

// Bottleneck
for (const target of ["monolith", "microservices"]) {
  const scaling =
    target === "monolith"
      ? {
          MONOLITH_REPLICAS: "2",
        }
      : {
          PRODUCT_REPLICAS: "1",
          ORDER_REPLICAS: "1",
          PAYMENT_REPLICAS: "1",
          PRICING_REPLICAS: "5",
        };

  for (const load of bottleneckLoads) {
    addCase(target, "bottleneck", "horizontal", load, scaling);
  }
}

function averageColumn(rows, columnIndex) {
  const values = rows
    .map((row) => row[columnIndex])
    .filter((value) => value !== "" && value !== null)
    .map(Number)
    .filter(Number.isFinite);

  if (values.length === 0) {
    return "";
  }

  const average =
    values.reduce((sum, value) => sum + value, 0) / values.length;

  return Number(average.toFixed(2));
}

fs.mkdirSync(resultsRoot, { recursive: true });

console.log(`Running ${cases.length} experiments per run.`);
console.log(`Runs: ${runNames.join(", ")}`);
console.log(`Results root: ${resultsRoot}`);

const allRunRows = [];

for (const runName of runNames) {
  const resultsDir = path.join(resultsRoot, runName);
  const summaryPath = path.join(resultsDir, "summary.csv");
  const runRows = [];

  fs.mkdirSync(resultsDir, { recursive: true });

  fs.writeFileSync(
    summaryPath,
    csvRow(summaryHeader) + "\n"
  );

  fs.writeFileSync(
    path.join(resultsDir, "manifest.json"),
    JSON.stringify(
      {
        run: runName,
        createdAt: new Date().toISOString(),
        cases: cases.map(
          ({ name, summaryName, script, env }) => ({
            name,
            summaryName,
            script,
            ...env,
          })
        ),
      },
      null,
      2
    )
  );

  console.log(`\n\n========== ${runName} ==========`);

  for (const testCase of cases) {
    console.log(`\n=== ${runName}: ${testCase.name} ===`);

    const result = spawnSync(
      process.execPath,
      [testCase.script],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          ...testCase.env,
          RESULTS_DIR: resultsDir,
          RUN_NAME: testCase.name,
        },
      }
    );

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      console.error(
        `Experiment failed: ${runName}/${testCase.name} ` +
        `(exit ${result.status})`
      );
      process.exit(result.status || 1);
    }

    const summaryFile = path.join(
      resultsDir,
      testCase.name,
      "summary.json"
    );

    if (!fs.existsSync(summaryFile)) {
      throw new Error(
        `Expected summary file not found: ${summaryFile}`
      );
    }

    const row = getSummaryRow(testCase, summaryFile);

    runRows.push(row);

    fs.appendFileSync(
      summaryPath,
      csvRow(row) + "\n"
    );

    console.log(`Recorded summary: ${testCase.summaryName}`);
  }

  allRunRows.push(runRows);

  console.log(`\nCompleted ${runName}: ${summaryPath}`);
}

// Average across the three runs
const rowsByName = new Map();

for (const runRows of allRunRows) {
  for (const row of runRows) {
    if (!rowsByName.has(row[0])) {
      rowsByName.set(row[0], []);
    }

    rowsByName.get(row[0]).push(row);
  }
}

const finalSummaryPath = path.join(resultsRoot, "summary.csv");
const finalRows = [csvRow(summaryHeader)];

for (const testCase of cases) {
  const matchingRows = rowsByName.get(testCase.summaryName);

  if (!matchingRows || matchingRows.length !== runNames.length) {
    throw new Error(
      `Expected ${runNames.length} rows for ${testCase.summaryName}, ` +
      `found ${matchingRows?.length ?? 0}`
    );
  }

  const averagedRow = [
    testCase.summaryName,
    ...summaryHeader.slice(1).map((_, index) =>
      averageColumn(matchingRows, index + 1)
    ),
  ];

  finalRows.push(csvRow(averagedRow));
}

fs.writeFileSync(
  finalSummaryPath,
  finalRows.join("\n") + "\n"
);

console.log("\n========== ALL RUNS COMPLETE ==========");
console.log(`Run summaries: ${resultsRoot}/run-1/summary.csv`);
console.log(`               ${resultsRoot}/run-2/summary.csv`);
console.log(`               ${resultsRoot}/run-3/summary.csv`);
console.log(`Averaged summary: ${finalSummaryPath}`);
