import { Router, Request, Response } from "express";
import { param } from "express-validator";
import { validate } from "../middleware/validate";
import { pool } from "../db/pool";

const router = Router();

router.post(
  "/payment/:id/pay",
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
    await pool.query(
      `
      UPDATE orders
      SET paid = TRUE
      WHERE id = $1`,
      [id],
    );
    order.rows[0].paid = true;
    res.json(order.rows[0]);
  },
);

export default router;
