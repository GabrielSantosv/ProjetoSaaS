package com.portfolio.saas.cashier.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CloseCashRegisterRequest(
        @NotNull(message = "O valor em dinheiro contado no caixa é obrigatório")
        @DecimalMin(value = "0.00", inclusive = true, message = "O valor em dinheiro não pode ser negativo")
        BigDecimal cashAmount,

        @NotNull(message = "O valor em cartão contado no caixa é obrigatório")
        @DecimalMin(value = "0.00", inclusive = true, message = "O valor em cartão não pode ser negativo")
        BigDecimal cardAmount
) {
    public BigDecimal cashDifference(BigDecimal expectedCash) {
        return cashAmount.subtract(expectedCash);
    }

    public BigDecimal cardDifference(BigDecimal expectedCard) {
        return cardAmount.subtract(expectedCard);
    }
}
