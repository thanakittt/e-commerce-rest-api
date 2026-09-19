-- ==========================================================
-- E-Commerce REST API - Database Seed Script
-- All passwords default to: password123
-- ==========================================================

-- 1. Reset tables and identity counters
TRUNCATE TABLE 
    order_items, 
    orders, 
    cart_items, 
    carts, 
    products, 
    users, 
    categories 
RESTART IDENTITY CASCADE;

-- 2. Seed Categories
INSERT INTO categories (id, name) OVERRIDING SYSTEM VALUE VALUES
    (1, 'Electronics'),
    (2, 'Clothing'),
    (3, 'Home & Kitchen'),
    (4, 'Books'),
    (5, 'Beauty & Personal Care'),
    (6, 'Sports & Outdoors');

-- 3. Seed Users (password: password123)
INSERT INTO users (id, name, email, password, role, phone) OVERRIDING SYSTEM VALUE VALUES
    (1, 'Admin User', 'admin@example.com', '$2b$10$reAMFmoK.ohInAYVL9YGjulnmkok6YuvPIhzZFo01NWrdlLGYqWCq', 'admin', '0811111111'),
    (2, 'Alice Johnson', 'alice@example.com', '$2b$10$reAMFmoK.ohInAYVL9YGjulnmkok6YuvPIhzZFo01NWrdlLGYqWCq', 'user', '0822222222'),
    (3, 'Bob Smith', 'bob@example.com', '$2b$10$reAMFmoK.ohInAYVL9YGjulnmkok6YuvPIhzZFo01NWrdlLGYqWCq', 'user', '0833333333'),
    (4, 'Charlie Brown', 'charlie@example.com', '$2b$10$reAMFmoK.ohInAYVL9YGjulnmkok6YuvPIhzZFo01NWrdlLGYqWCq', 'user', '0844444444');

-- 4. Seed Products
INSERT INTO products (id, name, price, stock, description, category_id) OVERRIDING SYSTEM VALUE VALUES
    (1, 'Wireless Noise-Cancelling Headphones', 199.99, 50, 'High-fidelity audio with active noise cancellation.', 1),
    (2, 'Mechanical Gaming Keyboard', 89.50, 75, 'RGB backlit with hot-swappable mechanical switches.', 1),
    (3, 'Classic Cotton T-Shirt', 19.90, 150, '100% breathable organic cotton t-shirt in black.', 2),
    (4, 'Slim-Fit Denim Jeans', 49.00, 80, 'Durable stretch denim with modern slim cut.', 2),
    (5, 'Stainless Steel Thermal Flask 1L', 24.99, 120, 'Double-wall vacuum insulation keeps drinks hot or cold for 24h.', 3),
    (6, 'Non-Stick Ceramic Frying Pan 28cm', 34.50, 45, 'Eco-friendly scratch-resistant ceramic coating.', 3),
    (7, 'Designing Data-Intensive Applications', 39.99, 60, 'The definitive guide to modern distributed systems and data storage.', 4),
    (8, 'Hydrating Facial Moisturizer 100ml', 15.75, 90, 'Daily lightweight moisturizer with hyaluronic acid.', 5),
    (9, 'Non-Slip Yoga Mat 6mm', 29.95, 40, 'Eco-friendly TPE material with alignment lines and carry strap.', 6),
    (10, 'Adjustable Dumbbell Set 20kg', 119.00, 25, 'Quick-change weight plates with textured non-slip grip.', 6);

-- 5. Seed Carts (1 active cart per user)
INSERT INTO carts (id, user_id, created_at) OVERRIDING SYSTEM VALUE VALUES
    (1, 2, NOW() - INTERVAL '3 days'),
    (2, 3, NOW() - INTERVAL '1 day'),
    (3, 4, NOW() - INTERVAL '5 hours');

-- 6. Seed Cart Items
INSERT INTO cart_items (cart_id, product_id, quantity) VALUES
    (1, 1, 1),
    (1, 3, 2),
    (2, 7, 1),
    (3, 9, 1),
    (3, 10, 1);

-- 7. Seed Orders
INSERT INTO orders (id, user_id, status, order_date, shipping_address, payment_method, cancellation_reason) OVERRIDING SYSTEM VALUE VALUES
    (1, 2, 'paid', NOW() - INTERVAL '10 days', '123 Sukhumvit Rd, Bangkok 10110', 'credit_card', NULL),
    (2, 2, 'shipped', NOW() - INTERVAL '4 days', '123 Sukhumvit Rd, Bangkok 10110', 'paypal', NULL),
    (3, 3, 'pending', NOW() - INTERVAL '2 days', '456 Silom Rd, Bangkok 10500', 'bank_transfer', NULL),
    (4, 4, 'cancelled', NOW() - INTERVAL '1 day', '789 Nimman Rd, Chiang Mai 50200', 'credit_card', 'Ordered by mistake');

-- 8. Seed Order Items
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (1, 2, 1, 89.50),
    (1, 4, 1, 49.00),
    (2, 5, 2, 24.99),
    (3, 1, 1, 199.99),
    (3, 2, 1, 89.50),
    (4, 6, 1, 34.50);

-- 9. Synchronize Identity Sequences
SELECT setval(pg_get_serial_sequence('categories', 'id'), COALESCE((SELECT MAX(id) FROM categories), 1));
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE((SELECT MAX(id) FROM products), 1));
SELECT setval(pg_get_serial_sequence('carts', 'id'), COALESCE((SELECT MAX(id) FROM carts), 1));
SELECT setval(pg_get_serial_sequence('orders', 'id'), COALESCE((SELECT MAX(id) FROM orders), 1));
