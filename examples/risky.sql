BEGIN;

CREATE INDEX orders_customer_id_idx ON orders (customer_id);

ALTER TABLE orders
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE orders
  ALTER COLUMN total TYPE numeric(14, 2);

ALTER TABLE orders
  ADD CONSTRAINT orders_customer_fk
  FOREIGN KEY (customer_id) REFERENCES customers(id);

COMMIT;
