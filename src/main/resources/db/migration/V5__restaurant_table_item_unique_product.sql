-- Garante que cada produto apareça em no máximo uma linha por comanda,
-- permitindo um upsert atômico (INSERT ... ON DUPLICATE KEY UPDATE) que
-- soma a quantidade em vez de criar linhas duplicadas quando duas
-- requisições concorrentes adicionam o mesmo item na mesma mesa.
ALTER TABLE restaurant_table_items
    ADD CONSTRAINT uq_table_item_product UNIQUE (restaurant_table_id, product_id);
