-- Up Migration
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL
);

-- Down Migration
DROP TABLE IF EXISTS products;