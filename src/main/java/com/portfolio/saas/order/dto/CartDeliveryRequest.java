package com.portfolio.saas.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CartDeliveryRequest(
        @Size(max = 500, message = "O endereço de entrega deve ter no máximo 500 caracteres")
        String address,

        @NotBlank(message = "A forma de entrega é obrigatória")
        String shippingMethod,

        @NotBlank(message = "A forma de pagamento é obrigatória")
        String paymentMethod
) {}
