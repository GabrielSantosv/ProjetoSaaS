package com.portfolio.saas.tenant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TenantUpdateRequest(
        @NotBlank(message = "A razão social é obrigatória")
        @Size(max = 150, message = "A razão social deve ter no máximo 150 caracteres")
        String name,

        @NotBlank(message = "O documento (CNPJ/CPF) é obrigatório")
        @Size(max = 20, message = "O documento deve ter no máximo 20 caracteres")
        String document,

        @NotBlank(message = "O identificador do plano é obrigatório")
        String planId
) {}
