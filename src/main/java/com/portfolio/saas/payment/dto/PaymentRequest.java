package com.portfolio.saas.payment.dto;

import com.portfolio.saas.payment.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record PaymentRequest(
        @NotBlank(message = "O identificador do pedido é obrigatório")
        String orderId,

        @NotNull(message = "O método de pagamento é obrigatório")
        PaymentMethod method,

        @NotNull(message = "O valor do pagamento é obrigatório")
        @DecimalMin(value = "0.01", inclusive = false, message = "O valor do pagamento deve ser maior que zero")
        BigDecimal amount
) {}
