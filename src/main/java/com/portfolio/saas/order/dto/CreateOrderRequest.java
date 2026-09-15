package com.portfolio.saas.order.dto;

import com.portfolio.saas.order.OrderChannel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CreateOrderRequest(
        @NotBlank(message = "O identificador do cliente é obrigatório")
        String customerId,

        @NotNull(message = "O canal do pedido é obrigatório")
        OrderChannel channel,

        @NotNull(message = "O pedido deve conter itens")
        @Valid
        List<OrderItemRequest> items,

        String deliveryAddress,

        String paymentMethod
) {
    public CreateOrderRequest(String customerId, OrderChannel channel, List<OrderItemRequest> items) {
        this(customerId, channel, items, null, null);
    }
}
