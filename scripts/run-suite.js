
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const suiteName =
  process.env.SUITE_NAME ||
  `suite-${new Date().toISOString().replace(/[:.]/g, "-")}`;

const resultsDir = path.resolve("results", suiteName);

const baseline = {
  MONOLITH_REPLICAS: "1",
  MONOLITH_CPUS: "1.0",
  MONOLITH_MEMORY: "1G",

  PRODUCT_REPLICAS: "1",
  PRODUCT_CPUS: "0.25",
  PRODUCT_MEMORY: "256M",

  ORDER_REPLICAS: "1",
  ORDER_CPUS: "0.25",
  ORDER_MEMORY: "256M",

  PAYMENT_REPLICAS: "1",
  PAYMENT_CPUS: "0.25",
  PAYMENT_MEMORY: "256M",

  PRICING_REPLICAS: "1",
  PRICING_CPUS: "0.25",
  PRICING_MEMORY: "256M",
};

const baselineLoads = [
  {
    name: "low",
    VUS: "1",
    ITERATIONS: "500",
    PRICING_ITERATIONS: "1000",
  },
  {
    name: "medium",
    VUS: "10",
    ITERATIONS: "500",
    PRICING_ITERATIONS: "1000",
  },
  {
    name: "high",
    VUS: "25",
    ITERATIONS: "500",
    PRICING_ITERATIONS: "1000",
  },
];

const bottleneckLoads = [
  {
    name: "low",
    VUS: "1",
    ITERATIONS: "100",
    PRICING_ITERATIONS: "100000",
  },
  {
    name: "medium",
    VUS: "10",
    ITERATIONS: "100",
    PRICING_ITERATIONS: "100000",
  },
  {
    name: "high",
    VUS: "25",
    ITERATIONS: "100",
    PRICING_ITERATIONS: "100000",
  },
];

const cases = [];

function addCase(target, test, variant, load, scaling = {}) {
  const isBottleneck = test === "bottleneck";

  cases.push({
    name: `${target}-${test}-${variant}-${load.name}`,
    script: isBottleneck
      ? "scripts/run-bottleneck.js"
      : "scripts/run-e2e.js",
    env: {
      ...baseline,
      ...load,
      ...scaling,
      TARGET: target,
      MAX_DURATION: isBottleneck ? "60m" : "10m",
    },
  });
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

// Vertical scaling, double CPU and memory
for (const target of ["monolith", "microservices"]) {
  const scaling =
    target === "monolith"
      ? {
          MONOLITH_CPUS: "2.0",
          MONOLITH_MEMORY: "2G",
        }
      : {
          PRODUCT_CPUS: "0.5",
          PRODUCT_MEMORY: "512M",
          ORDER_CPUS: "0.5",
          ORDER_MEMORY: "512M",
          PAYMENT_CPUS: "0.5",
          PAYMENT_MEMORY: "512M",
          PRICING_CPUS: "0.5",
          PRICING_MEMORY: "512M",
        };

  addCase(
    target,
    "e2e",
    "vertical",
    baselineLoads[1],
    scaling
  );

  addCase(
    target,
    "bottleneck",
    "vertical",
    bottleneckLoads[1],
    scaling
  );
}

// Horizontal scaling
for (const target of ["monolith", "microservices"]) {
  for (const test of ["e2e", "bottleneck"]) {
    let scaling;

    if (target === "monolith") {
      scaling = { MONOLITH_REPLICAS: "2" };
    } else if (test === "e2e") {
      scaling = {
        PRODUCT_REPLICAS: "2",
        ORDER_REPLICAS: "2",
        PAYMENT_REPLICAS: "2",
        PRICING_REPLICAS: "2",
      };
    } else {
      scaling = { PRICING_REPLICAS: "4" };
    }

    const load =
      test === "e2e"
        ? baselineLoads[1]
        : bottleneckLoads[1];

    addCase(target, test, "horizontal", load, scaling);
  }
}

fs.mkdirSync(resultsDir, { recursive: true });

fs.writeFileSync(
  path.join(resultsDir, "manifest.json"),
  JSON.stringify(
    {
      suite: suiteName,
      createdAt: new Date().toISOString(),
      cases: cases.map(({ name, script, env }) => ({
        name,
        script,
        ...env,
      })),
    },
    null,
    2
  )
);

console.log(`Running ${cases.length} experiments.`);
console.log(`Results: ${resultsDir}`);

for (const testCase of cases) {
  console.log(`\n=== ${testCase.name} ===`);

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
      `Experiment failed: ${testCase.name} (exit ${result.status})`
    );
    process.exit(result.status || 1);
  }
}

console.log(`\nSuite complete: ${resultsDir}`);
