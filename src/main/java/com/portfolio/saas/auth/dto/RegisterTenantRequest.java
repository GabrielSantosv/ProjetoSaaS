package com.portfolio.saas.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterTenantRequest(
        @NotBlank(message = "O nome da empresa/loja é obrigatório")
        String companyName,

        @NotBlank(message = "O documento (CNPJ/CPF) é obrigatório")
        String document,

        @NotBlank(message = "O identificador do plano é obrigatório")
        String planId,

        @NotBlank(message = "O nome do administrador é obrigatório")
        String adminName,

        @NotBlank(message = "O e-mail do administrador é obrigatório")
        @Email(message = "E-mail inválido")
        String adminEmail,

        @NotBlank(message = "A senha é obrigatória")
        @Size(min = 6, message = "A senha deve ter no mínimo 6 caracteres")
        String adminPassword
) {}
