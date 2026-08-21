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
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                register.getStatus(),
                register.getCreatedAt(),
                register.getUpdatedAt()
        );
    }

    public static CashRegisterResponse fromEntity(CashRegister register, BigDecimal cashDifference, BigDecimal cardDifference) {
        if (register == null) return null;
        return new CashRegisterResponse(
                register.getId(),
                register.getTenantId(),
                register.getOpenedAt(),
                register.getClosedAt(),
                register.getTotalCash(),
                register.getTotalCard(),
                cashDifference,
                cardDifference,
                register.getStatus(),
                register.getCreatedAt(),
                register.getUpdatedAt()
        );
    }
}
