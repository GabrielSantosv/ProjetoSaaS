package com.portfolio.saas.catalog.dto;

import jakarta.validation.constraints.NotNull;

public record StockAdjustmentRequest(
        @NotNull(message = "A quantidade de ajuste é obrigatória")
        Integer deltaQuantity
) {}
