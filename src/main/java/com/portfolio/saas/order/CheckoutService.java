package com.portfolio.saas.order;

import com.portfolio.saas.order.dto.OrderResponse;

public interface CheckoutService {

    OrderResponse checkout(String customerId);
}
