package com.portfolio.saas.cashier.dto;

import com.portfolio.saas.cashier.CashRegister;
import com.portfolio.saas.cashier.CashRegisterStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CashRegisterResponse(
        String id,
        String tenantId,
        LocalDateTime openedAt,
        LocalDateTime closedAt,
        BigDecimal totalCash,
        BigDecimal totalCard,
        BigDecimal cashDifference,
        BigDecimal cardDifference,
        CashRegisterStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static CashRegisterResponse fromEntity(CashRegister register) {
        if (register == null) return null;
        return new CashRegisterResponse(
                register.getId(),
                register.getTenantId(),
                register.getOpenedAt(),
                register.getClosedAt(),
                register.getTotalCash(),
                register.getTotalCard(),
                register.getCashDifference(),
                register.getCardDifference(),
                register.getStatus(),
                register.getCreatedAt(),
                register.getUpdatedAt()
        );
    }

    /**
     * Como um caixa aberto não tem totalCash/totalCard persistidos (só são
     * gravados no fechamento), esta variante devolve o mesmo registro com uma
     * prévia calculada na hora a partir dos pagamentos já recebidos no turno,
     * sem persistir nada — é só o que a tela de conciliação mostra como
     * "esperado" antes do operador confirmar o fechamento.
     */
    public static CashRegisterResponse withLiveTotals(CashRegister register, BigDecimal liveCash, BigDecimal liveCard) {
        if (register == null) return null;
        return new CashRegisterResponse(
                register.getId(),
                register.getTenantId(),
                register.getOpenedAt(),
                register.getClosedAt(),
                liveCash,
                liveCard,
                register.getCashDifference(),
                register.getCardDifference(),
                register.getStatus(),
                register.getCreatedAt(),
                register.getUpdatedAt()
        );
    }
}
