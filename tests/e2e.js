
import http from 'k6/http';
import { check, fail } from 'k6';
import { Counter } from 'k6/metrics';

const completedWorkflows = new Counter('completed_workflows');
const failedWorkflows = new Counter('failed_workflows');

export const options = {
  scenarios: {
    e2e_checkout: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 100,
      maxDuration: '3m',
    },
  },
};

const TARGET = __ENV.TARGET || 'monolith';
const BASE_URL = TARGET == 'monolith' ? 'http://localhost:3000/api' : 'http://localhost:3001/api';

const headers = {
  'Content-Type': 'application/json',
};

export default function () {
    try {
        // create product
        const createProduct = http.post(
            `${BASE_URL}/products`,
            JSON.stringify({
            name: `Benchmark Product ${__VU}-${__ITER}`,
            price: 19.99,
            }),
            { headers },
        );

        check(createProduct, {
            'product created': (r) => r.status >= 200 && r.status < 300,
        });

        if (createProduct.status < 200 || createProduct.status >= 300) {
            fail(`Create product failed: ${createProduct.status} ${createProduct.body}`);
        }

        const products = createProduct.json();
        const productId = products[0]?.id;

        if (!productId) {
            fail(`Product response missing id: ${createProduct.body}`);
        }

        // get products
        const getProducts = http.get(`${BASE_URL}/products`);

        check(getProducts, {
            'products retrieved': (r) => r.status === 200,
        });

        // create an order using created product
        const createOrder = http.post(
            `${BASE_URL}/orders`,
            JSON.stringify({
            products: [productId],
            }),
            { headers },
        );

        check(createOrder, {
            'order created': (r) => r.status >= 200 && r.status < 300,
        });

        if (createOrder.status < 200 || createOrder.status >= 300) {
            fail(`Create order failed: ${createOrder.status} ${createOrder.body}`);
        }

        const order = createOrder.json();
        const orderId = order.id;

        if (!orderId) {
            fail(`Order response missing id: ${createOrder.body}`);
        }

        // get orders
        const getOrders = http.get(`${BASE_URL}/orders`);

        check(getOrders, {
            'orders retrieved': (r) => r.status === 200,
        });

        // price order (cpu heavy)
        const priceOrder = http.get(`${BASE_URL}/orders/${orderId}/price`);

        check(priceOrder, {
            'order priced': (r) => r.status >= 200 && r.status < 300,
        });

        if (priceOrder.status < 200 || priceOrder.status >= 300) {
            fail(`Price order failed: ${priceOrder.status} ${priceOrder.body}`);
        }

        // pay order (fixed delay)
        const payOrder = http.post(`${BASE_URL}/orders/${orderId}/pay`);

        check(payOrder, {
            'order paid': (r) => r.status >= 200 && r.status < 300,
        });

        if (payOrder.status < 200 || payOrder.status >= 300) {
            fail(`Pay order failed: ${payOrder.status} ${payOrder.body}`);
        }

        completedWorkflows.add(1);
    } catch (error) {
        failedWorkflows.add(1);
    }
}
