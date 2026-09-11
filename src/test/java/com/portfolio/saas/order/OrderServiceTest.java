package com.portfolio.saas.order;

import com.portfolio.saas.catalog.Product;
import com.portfolio.saas.catalog.ProductService;
import com.portfolio.saas.catalog.ProductStatus;
import com.portfolio.saas.catalog.dto.ProductResponse;
import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.order.dto.CreateOrderRequest;
import com.portfolio.saas.order.dto.OrderItemRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private ProductService productService;

    @InjectMocks
    private OrderServiceImpl orderService;

    @Test
    @DisplayName("Deve criar pedido confirmado com baixa de estoque atômica")
    void shouldCreateOrderAndDecreaseStock() {
        Product product = new Product("SKU-100", "Cafeteira", new BigDecimal("250.00"), 10, null);
        product.setId("prod-100");

        when(productService.getProductEntityById("prod-100")).thenReturn(product);
        when(productService.updateStock("prod-100", -2)).thenReturn(new ProductResponse(
                "prod-100", "tenant-1", "SKU-100", "Cafeteira", new BigDecimal("250.00"), 8,
                null, null, new BigDecimal("100.00"), ProductStatus.ACTIVE, null, null, null
        ));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order order = invocation.getArgument(0);
            order.setId("order-1");
            return order;
        });

        CreateOrderRequest request = new CreateOrderRequest(
                "customer-1",
                OrderChannel.ECOMMERCE,
                List.of(new OrderItemRequest("prod-100", 2))
        );

        var response = orderService.createOrder(request);

        assertThat(response).isNotNull();
        assertThat(response.customerId()).isEqualTo("customer-1");
        assertThat(response.status()).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(response.items()).hasSize(1);
        assertThat(response.total()).isEqualByComparingTo("500.00");
    }

    @Test
    @DisplayName("Deve bloquear pedido quando produto não tem estoque suficiente")
    void shouldRejectOrderWhenStockIsInsufficient() {
        Product product = new Product("SKU-200", "Monitor", new BigDecimal("800.00"), 1, null);
        product.setId("prod-200");

        when(productService.getProductEntityById("prod-200")).thenReturn(product);

        CreateOrderRequest request = new CreateOrderRequest(
                "customer-2",
                OrderChannel.ECOMMERCE,
                List.of(new OrderItemRequest("prod-200", 5))
        );

        assertThatThrownBy(() -> orderService.createOrder(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Estoque insuficiente");
    }
}
