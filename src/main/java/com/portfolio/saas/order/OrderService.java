package com.portfolio.saas.order;

import com.portfolio.saas.common.dto.PageResponse;
import com.portfolio.saas.order.dto.CreateOrderRequest;
import com.portfolio.saas.order.dto.OrderListResponse;
import com.portfolio.saas.order.dto.OrderResponse;
import org.springframework.data.domain.Pageable;

public interface OrderService {

    OrderResponse createOrder(CreateOrderRequest request);

    PageResponse<OrderResponse> getOrdersByCustomer(String customerId, Pageable pageable);

    OrderListResponse getOrdersForAdmin(String status, String channel, String search, Pageable pageable);

    OrderResponse getOrderById(String id);

    Order getOrderEntityById(String id);

    OrderResponse cancelOrder(String id);
}
