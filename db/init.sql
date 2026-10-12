DROP DATABASE IF EXISTS monolith WITH (FORCE);
DROP DATABASE IF EXISTS microservices WITH (FORCE);

CREATE DATABASE monolith;
CREATE DATABASE microservices;

\connect monolith

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price DOUBLE PRECISION,
    paid BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE order_products (
    order_id UUID NOT NULL REFERENCES orders(id),
    product_id UUID NOT NULL REFERENCES products(id),
    UNIQUE (order_id, product_id)
);

\connect microservices

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price DOUBLE PRECISION,
    paid BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE order_products (
    order_id UUID NOT NULL REFERENCES orders(id),
    product_id UUID NOT NULL REFERENCES products(id),
    UNIQUE (order_id, product_id)
);