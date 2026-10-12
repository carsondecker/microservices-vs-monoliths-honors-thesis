import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { pool } from '../db/pool';

const router = Router();

router.get('/products', async (req: Request, res: Response) => {
  const result = await pool.query("SELECT * FROM products");
  res.send(result.rows);
});

router.post(
  '/products',
  [
    body('name').isString().isLength({ min: 1 }).withMessage('Valid name is required'),
    body('price').isNumeric().withMessage('Valid price is required'),
  ],
  validate,
  async (req: Request, res: Response) => {
    const body = req.body
    const result = await pool.query(
      `
        INSERT INTO products (name, price)
        VALUES ($1, $2)
        RETURNING id, name, price
      `,
      [body.name, body.price]
    );
    res.send(result.rows);
  }
);

export default router;
