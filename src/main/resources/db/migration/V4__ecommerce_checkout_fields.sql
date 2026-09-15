ALTER TABLE orders
    ADD COLUMN delivery_address VARCHAR(500) NULL;

ALTER TABLE orders
    ADD COLUMN payment_method VARCHAR(60) NULL;
