package com.portfolio.saas.pdv.dto;

import jakarta.validation.constraints.NotBlank;

public record OpenTableRequest(
        @NotBlank(message = "O número da mesa é obrigatório")
        String tableNumber,

        @NotBlank(message = "O nome do cliente é obrigatório")
        String customerName
) {}
