
import http from "k6/http";
import { check, fail, sleep } from "k6";
import { Counter } from "k6/metrics";

const completedWorkflows = new Counter("completed_workflows");
const failedWorkflows = new Counter("failed_workflows");

export const options = {
  scenarios: {
    pricing_bottleneck: {
      executor: "shared-iterations",
      vus: Number(__ENV.VUS || 10),
      iterations: Number(__ENV.ITERATIONS || 100),
      maxDuration: __ENV.MAX_DURATION || "10m",
    },
  },
};

const TARGET = __ENV.TARGET || "monolith";
const BASE_URL =
  TARGET === "monolith"
    ? "http://localhost:3000/api"
    : "http://localhost:3001/api";

const headers = { "Content-Type": "application/json" };

function waitForApi(url) {
  while (true) {
    const response = http.get(url, { timeout: "5s" });

    if (response.status === 200) {
      console.log("API is ready.");
      return;
    }

    console.log(`Waiting for API: status=${response.status}`);
    sleep(1);
  }
}

export function setup() {
  waitForApi(`${BASE_URL}/products`);
}

function requireResponse(response, name, predicate) {
  const passed = predicate(response);

  check(response, {
    [name]: () => passed,
  });

  if (!passed) {
    failedWorkflows.add(1);
    fail(
      `${name} failed: status=${response.status}, ` +
        `body=${String(response.body).slice(0, 500)}`
    );
  }
}

export default function () {
  // Create product
  const createProduct = http.post(
    `${BASE_URL}/products`,
    JSON.stringify({
      name: `Benchmark Product ${__VU}-${__ITER}`,
      price: 19.99,
    }),
    { headers }
  );

  requireResponse(
    createProduct,
    "product created",
    (r) => r.status >= 200 && r.status < 300
  );

  const products = createProduct.json();
  const productId = Array.isArray(products)
    ? products[0]?.id
    : products?.id;

  if (!productId) {
    failedWorkflows.add(1);
    fail(`Product response missing id: ${createProduct.body}`);
  }

  // Create order for pricing
  const createOrder = http.post(
    `${BASE_URL}/orders`,
    JSON.stringify({ products: [productId] }),
    { headers }
  );

  requireResponse(
    createOrder,
    "order created",
    (r) => r.status >= 200 && r.status < 300
  );

  const orderId = createOrder.json()?.id;

  if (!orderId) {
    failedWorkflows.add(1);
    fail(`Order response missing id: ${createOrder.body}`);
  }

  // CPU-heavy pricing operation
  const priceOrder = http.get(
    `${BASE_URL}/orders/${orderId}/price`
  );

  requireResponse(
    priceOrder,
    "order priced",
    (r) => r.status >= 200 && r.status < 300
  );

  completedWorkflows.add(1);
}
