import { Router, Request, Response } from "express";
import { body, param } from "express-validator";
import { validate } from "../middleware/validate";
import { pool } from "../db/pool";

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
    const existCheck = await pool.query(
      `SELECT id FROM products WHERE id = ANY($1::uuid[])`,
      [productIds],
    );
    if (existCheck.rows.length !== new Set(productIds).size) {
      return res.status(404).json({
        error: "One or more products were not found.",
      });
    }
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
    const id = String(req.params.id);
    const existsCheck = await pool.query(
      `SELECT EXISTS(SELECT 1 FROM orders WHERE id = $1) AS exists`,
      [id],
    );
    if (!existsCheck.rows[0].exists) {
      return res.status(404).json({ error: "Order not found." });
    }
    try {
      const response = await fetch(
        `${process.env.BASE_URL}/payment/${id}/pay`,
        {
          method: "POST",
        },
      );

      const body = await response.text();

      res.status(response.status);

      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }

      res.send(body);
    } catch (error) {
      console.error("Payment service request failed:", error);
      res.status(500).json({ error: "Payment service unavailable" });
    }
  },
);

router.post(
  "/orders/:id/pay",
  [param("id").isUUID().withMessage("Id must be a valid UUID")],
  validate,
  async (req: Request, res: Response) => {
    const id = req.params.id;
    const existsCheck = await pool.query(
      `SELECT EXISTS(SELECT 1 FROM orders WHERE id = $1) AS exists`,
      [id],
    );
    if (!existsCheck.rows[0].exists) {
      return res.status(404).json({ error: "Order not found." });
    }
    try {
      const response = await fetch(`${process.env.BASE_URL}/pricing/${id}`);

      const body = await response.text();

      res.status(response.status);

      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }

      res.send(body);
    } catch (error) {
      console.error("Pricing service request failed:", error);
      res.status(500).json({ error: "Pricing service unavailable" });
    }
  },
);

export default router;
