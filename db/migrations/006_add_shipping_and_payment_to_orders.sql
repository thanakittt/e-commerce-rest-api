-- 1. Create payment_method ENUM
CREATE TYPE payment_method AS ENUM ('credit_card', 'paypal', 'bank_transfer');

-- 2. Add columns as nullable first
ALTER TABLE orders
    ADD COLUMN shipping_address TEXT,
    ADD COLUMN payment_method payment_method;

-- 3. Backfill existing rows
UPDATE orders
SET shipping_address = ''
WHERE shipping_address IS NULL;

UPDATE orders
SET payment_method = 'credit_card'
WHERE payment_method IS NULL;

-- 4. Set NOT NULL constraints
ALTER TABLE orders
    ALTER COLUMN shipping_address SET NOT NULL,
    ALTER COLUMN payment_method SET NOT NULL;
