import { Router, Request, Response } from "express";
import { body, param } from "express-validator";
import { validate } from "../middleware/validate";
import { pool } from "../db/pool";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const router = Router();

router.get("/orders", async (req: Request, res: Response) => {
  const result = await pool.query("SELECT * FROM order_products");
  res.send(result.rows);
});

router.post(
  "/orders",
  [
    body("products")
      .isArray({ min: 1 })
      .withMessage("Products must be a non-empty array"),
    body("products.*")
      .isUUID()
      .withMessage("Each product must be a valid UUID"),
  ],
  validate,
  async (req: Request, res: Response) => {
    const productIds = req.body.products;
    const orderId = await pool.query(`
        INSERT INTO orders DEFAULT VALUES
        RETURNING id, price, paid
    `);
    await pool.query(
      `
        INSERT INTO order_products (order_id, product_id)
        SELECT $1, unnest($2::uuid[])`,
      [orderId.rows[0].id, productIds],
    );
    res.json(orderId.rows[0]);
  },
);

router.get(
  "/orders/:id/price",
  [param("id").isUUID().withMessage("Id must be a valid UUID")],
  validate,
  async (req: Request, res: Response) => {
    const id = req.params.id;
    const order = await pool.query(
      `
      SELECT * FROM orders WHERE id = $1`,
      [id],
    );
    if (order.rows[0].price) {
      return res.status(400).json({
        error: "Order has already been priced.",
      });
    }
    // TODO: NEED TO SWITCH TO CPU-INTENSIVE ALGORITHM
    const price = 1
    await pool.query(
      `
      UPDATE orders
      SET price = $1
      WHERE id = $2`,
      [price, id],
    );
    order.rows[0].price = price
    res.json(order.rows[0]);
  },
);

router.post(
  "/orders/:id/pay",
  [param("id").isUUID().withMessage("Id must be a valid UUID")],
  validate,
  async (req: Request, res: Response) => {
    const id = req.params.id;
    const order = await pool.query(
      `
      SELECT * FROM orders WHERE id = $1`,
      [id],
    );
    if (!order.rows[0].price) {
      return res.status(400).json({
        error: "Order has not been priced.",
      });
    }
    if (order.rows[0].paid) {
      return res.status(400).json({
        error: "Order has already been paid.",
      });
    }
    await sleep(2000);
    await pool.query(
      `
      UPDATE orders
      SET paid = TRUE
      WHERE id = $1`,
      [id],
    );
    order.rows[0].paid = true
    res.json(order.rows[0]);
  },
);

export default router;
