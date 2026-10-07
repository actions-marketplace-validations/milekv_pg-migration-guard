SET lock_timeout = '3s';
ALTER TABLE orders ALTER COLUMN status SET NOT NULL;
