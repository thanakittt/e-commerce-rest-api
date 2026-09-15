INSERT INTO categories (name) VALUES
    ('Electronics'),
    ('Clothing'),
    ('Home & Kitchen'),
    ('Books'),
    ('Beauty & Personal Care'),
    ('Sports & Outdoors')
ON CONFLICT (name) DO NOTHING;
