CREATE TABLE IF NOT EXISTS categories (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

ALTER TABLE products 
ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT;

CREATE INDEX idx_products_category_id ON products(category_id);
