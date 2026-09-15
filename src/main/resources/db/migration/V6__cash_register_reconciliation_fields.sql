-- Persiste a diferença de conciliação apurada no fechamento (antes só existia
-- em memória, perdida assim que a resposta do POST /close era enviada) e
-- adiciona controle de versão otimista para impedir dois fechamentos
-- concorrentes do mesmo caixa.
ALTER TABLE cash_registers
    ADD COLUMN cash_difference DECIMAL(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE cash_registers
    ADD COLUMN card_difference DECIMAL(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE cash_registers
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
