package com.portfolio.saas.order.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record OrderItemRequest(
        @NotBlank(message = "O identificador do produto é obrigatório")
        String productId,

        @NotNull(message = "A quantidade do item é obrigatória")
        @Min(value = 1, message = "A quantidade do item deve ser maior que zero")
        Integer quantity
) {}
