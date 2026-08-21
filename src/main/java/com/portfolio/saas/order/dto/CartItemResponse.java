package com.portfolio.saas.order.dto;

import java.math.BigDecimal;

public record CartItemResponse(
        String productId,
        String productName,
        BigDecimal unitPrice,
        Integer quantity,
        BigDecimal subtotal
) {}
