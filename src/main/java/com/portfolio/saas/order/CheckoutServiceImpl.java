package com.portfolio.saas.order;

import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.order.dto.CartResponse;
import com.portfolio.saas.order.dto.CreateOrderRequest;
import com.portfolio.saas.order.dto.OrderItemRequest;
import com.portfolio.saas.order.dto.OrderResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CheckoutServiceImpl implements CheckoutService {

    private final CartService cartService;
    private final OrderService orderService;

    public CheckoutServiceImpl(CartService cartService, OrderService orderService) {
        this.cartService = cartService;
        this.orderService = orderService;
    }

    @Override
    @Transactional
    public OrderResponse checkout(String customerId) {
        if (customerId == null || customerId.isBlank()) {
            throw new BusinessException("O identificador do cliente é obrigatório.");
        }

        CartResponse cart = cartService.getCart(customerId);
        if (cart.items() == null || cart.items().isEmpty()) {
            throw new BusinessException("O carrinho do cliente está vazio.");
        }

        List<OrderItemRequest> items = cart.items().stream()
                .map(item -> new OrderItemRequest(item.productId(), item.quantity()))
                .toList();

        OrderResponse created = orderService.createOrder(new CreateOrderRequest(customerId, OrderChannel.ECOMMERCE, items));
        cartService.clearCart(customerId);
        return created;
    }
}
