-- Up Migration
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price DOUBLE PRECISION,
    paid BOOLEAN NOT NULL DEFAULT FALSE
);

-- Down Migration
DROP TABLE IF EXISTS orders;