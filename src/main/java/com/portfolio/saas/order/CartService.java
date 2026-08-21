package com.portfolio.saas.order;

import com.portfolio.saas.order.dto.CartResponse;

public interface CartService {

    CartResponse addItem(String customerId, String productId, Integer quantity);

    CartResponse removeItem(String customerId, String productId);

    CartResponse updateQuantity(String customerId, String productId, Integer quantity);

    CartResponse getCart(String customerId);

    void clearCart(String customerId);
}
