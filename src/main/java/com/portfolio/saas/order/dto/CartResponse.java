package com.portfolio.saas.order.dto;

import java.math.BigDecimal;
import java.util.List;

public record CartResponse(
        String customerId,
        List<CartItemResponse> items,
        BigDecimal total,
        String deliveryAddress,
        String shippingMethod,
        String paymentMethod
) {}
