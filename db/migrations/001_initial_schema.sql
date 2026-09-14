-- 1. สร้าง ENUM Type สำหรับ Order Status
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'cancelled');

-- 2. สร้างตาราง users
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

-- 3. สร้างตาราง products
CREATE TABLE products (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    description TEXT
);

-- 4. สร้างตาราง cart_items
CREATE TABLE cart_items (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    CONSTRAINT uq_carts_user_product UNIQUE (user_id, product_id)
);

-- 5. สร้างตาราง orders
CREATE TABLE orders (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status order_status NOT NULL DEFAULT 'pending',
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- 6. สร้างตาราง order_items (Composite Primary Key)
CREATE TABLE order_items (
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL,
    PRIMARY KEY (order_id, product_id)
);
