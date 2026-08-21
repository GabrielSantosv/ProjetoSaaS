ALTER TABLE cash_registers
    ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'CLOSED';

ALTER TABLE cash_registers
    ADD COLUMN open_marker VARCHAR(36) NULL;

UPDATE cash_registers
SET open_marker = tenant_id
WHERE status = 'OPEN';

CREATE UNIQUE INDEX ux_cash_registers_open_tenant
    ON cash_registers (open_marker);
