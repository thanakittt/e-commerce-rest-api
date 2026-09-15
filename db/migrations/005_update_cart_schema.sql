-- 1. สร้างตาราง carts
CREATE TABLE carts (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE carts ADD CONSTRAINT uq_carts_user_id UNIQUE (user_id);

-- 2. ปรับปรุงตาราง cart_items ให้ใช้ (cart_id, product_id) เป็น Composite Primary Key
ALTER TABLE cart_items
    DROP CONSTRAINT IF EXISTS cart_items_pkey,
    DROP CONSTRAINT IF EXISTS uq_carts_user_product,
    DROP COLUMN IF EXISTS id,
    DROP COLUMN IF EXISTS user_id,
    ADD COLUMN cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    ADD PRIMARY KEY (cart_id, product_id);

