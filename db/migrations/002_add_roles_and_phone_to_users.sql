CREATE TYPE role AS ENUM ('admin', 'user');

ALTER TABLE users
ADD COLUMN role role NOT NULL DEFAULT 'user',
ADD COLUMN phone TEXT UNIQUE;
