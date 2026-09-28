-- Up Migration
CREATE TABLE order_products (
    order_id UUID NOT NULL REFERENCES orders(id),
    product_id UUID NOT NULL REFERENCES products(id),
    UNIQUE (order_id, product_id)
);

-- Down Migration
DROP TABLE IF EXISTS order_products;