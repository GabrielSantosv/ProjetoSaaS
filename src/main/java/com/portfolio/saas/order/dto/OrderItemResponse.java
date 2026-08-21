package com.portfolio.saas.order.dto;

import com.portfolio.saas.order.OrderItem;

import java.math.BigDecimal;

public record OrderItemResponse(
        String id,
        String productId,
        String productName,
        Integer quantity,
        BigDecimal unitPrice,
        BigDecimal subtotal
) {
    public static OrderItemResponse fromEntity(OrderItem item) {
        if (item == null) return null;
        return new OrderItemResponse(
                item.getId(),
                item.getProduct() != null ? item.getProduct().getId() : null,
                item.getProduct() != null ? item.getProduct().getName() : null,
                item.getQuantity(),
                item.getUnitPrice(),
                item.getSubtotal()
        );
    }
}
