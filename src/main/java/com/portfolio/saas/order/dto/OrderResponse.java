package com.portfolio.saas.order.dto;

import com.portfolio.saas.order.Order;
import com.portfolio.saas.order.OrderChannel;
import com.portfolio.saas.order.OrderStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record OrderResponse(
        String id,
        String customerId,
        OrderStatus status,
        BigDecimal total,
        OrderChannel channel,
        List<OrderItemResponse> items,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static OrderResponse fromEntity(Order order) {
        if (order == null) return null;
        return new OrderResponse(
                order.getId(),
                order.getCustomerId(),
                order.getStatus(),
                order.getTotal(),
                order.getChannel(),
                order.getItems() == null ? List.of() : order.getItems().stream().map(OrderItemResponse::fromEntity).toList(),
                order.getCreatedAt(),
                order.getUpdatedAt()
        );
    }
}
