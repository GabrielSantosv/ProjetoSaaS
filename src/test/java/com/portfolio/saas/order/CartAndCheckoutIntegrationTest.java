package com.portfolio.saas.order;

import com.portfolio.saas.catalog.Category;
import com.portfolio.saas.catalog.CategoryRepository;
import com.portfolio.saas.catalog.Product;
import com.portfolio.saas.catalog.ProductRepository;
import com.portfolio.saas.order.dto.CreateOrderRequest;
import com.portfolio.saas.order.dto.OrderItemRequest;
import com.portfolio.saas.tenant.Tenant;
import com.portfolio.saas.tenant.TenantContext;
import com.portfolio.saas.tenant.TenantRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class CartAndCheckoutIntegrationTest {

    @Autowired
    private CartService cartService;

    @Autowired
    private CheckoutService checkoutService;

    @Autowired
    private OrderService orderService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Tenant tenant;

    @BeforeEach
    void setUp() {
        String document = UUID.randomUUID().toString().replace("-", "").substring(0, 14);
        tenant = tenantRepository.save(new Tenant(null, "Tenant Ecommerce", document, "PRO", true));
        TenantContext.setTenantId(tenant.getId());

        Category category = new Category("Eletrônicos", "Aparelhos e acessórios");
        category.setTenantId(tenant.getId());
        category = categoryRepository.save(category);

        Product product = new Product("SKU-EC-01", "Notebook", new BigDecimal("3500.00"), 5, category);
        product.setTenantId(tenant.getId());
        productRepository.save(product);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        jdbcTemplate.execute("DELETE FROM order_items");
        jdbcTemplate.execute("DELETE FROM orders");
        jdbcTemplate.execute("DELETE FROM products");
        jdbcTemplate.execute("DELETE FROM categories");
        jdbcTemplate.execute("DELETE FROM users");
        jdbcTemplate.execute("DELETE FROM tenants");
    }

    @Test
    @DisplayName("Deve adicionar item ao carrinho e transformar em pedido confirmado no checkout")
    void shouldAddItemToCartAndCheckoutSuccessfully() {
        var cart = cartService.addItem("customer-1", productRepository.findBySku("SKU-EC-01").orElseThrow().getId(), 2);

        assertThat(cart.items()).hasSize(1);
        assertThat(cart.total()).isEqualByComparingTo("7000.00");

        cartService.updateDelivery("customer-1", null, "PICKUP", "PIX");
        var order = checkoutService.checkout("customer-1");

        assertThat(order.customerId()).isEqualTo("customer-1");
        assertThat(order.status()).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(order.total()).isEqualByComparingTo("7000.00");
        assertThat(cartService.getCart("customer-1").items()).isEmpty();

        Product product = productRepository.findBySku("SKU-EC-01").orElseThrow();
        assertThat(product.getStockQuantity()).isEqualTo(3);
    }

    @Test
    @DisplayName("Deve bloquear adição ao carrinho quando o item excede o estoque disponível")
    void shouldRejectCheckoutWhenCartExceedsAvailableStock() {
        Product product = productRepository.findBySku("SKU-EC-01").orElseThrow();

        assertThatThrownBy(() -> cartService.addItem("customer-1", product.getId(), 6))
                .isInstanceOf(com.portfolio.saas.common.exception.BusinessException.class)
                .hasMessageContaining("Estoque insuficiente");
    }

    @Test
    @DisplayName("Deve criar pedido diretamente a partir do payload do ecommerce e validar baixa atômica")
    void shouldCreateOrderFromDirectOrderPayload() {
        Product product = productRepository.findBySku("SKU-EC-01").orElseThrow();

        var response = orderService.createOrder(new CreateOrderRequest(
                "customer-2",
                OrderChannel.ECOMMERCE,
                List.of(new OrderItemRequest(product.getId(), 2))
        ));

        assertThat(response.status()).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(response.total()).isEqualByComparingTo("7000.00");

        Product refreshed = productRepository.findBySku("SKU-EC-01").orElseThrow();
        assertThat(refreshed.getStockQuantity()).isEqualTo(3);
    }

    @Test
    @DisplayName("Deve reverter uma baixa já aplicada quando um item posterior falha durante a criação do pedido")
    void shouldRollbackAlreadyAppliedStockDecreaseWhenLaterItemFails() {
        Product firstProduct = productRepository.findBySku("SKU-EC-01").orElseThrow();
        Product secondProduct = new Product("SKU-EC-02", "Mouse", new BigDecimal("150.00"), 10, firstProduct.getCategory());
        secondProduct.setTenantId(tenant.getId());
        secondProduct = productRepository.save(secondProduct);

        Product productInDb = productRepository.findByIdScoped(firstProduct.getId()).orElseThrow();
        productInDb.setStockQuantity(1);
        productRepository.save(productInDb);

        var request = new CreateOrderRequest(
                "customer-1",
                OrderChannel.ECOMMERCE,
                List.of(
                        new OrderItemRequest(secondProduct.getId(), 1),
                        new OrderItemRequest(firstProduct.getId(), 2)
                )
        );

        assertThatThrownBy(() -> orderService.createOrder(request))
                .isInstanceOf(com.portfolio.saas.common.exception.BusinessException.class)
                .hasMessageContaining("Estoque insuficiente");

        Product refreshedFirst = productRepository.findByIdScoped(firstProduct.getId()).orElseThrow();
        assertThat(refreshedFirst.getStockQuantity()).isEqualTo(1);

        Product refreshedSecond = productRepository.findByIdScoped(secondProduct.getId()).orElseThrow();
        assertThat(refreshedSecond.getStockQuantity()).isEqualTo(10);
    }

    @Test
    @DisplayName("Deve bloquear checkout quando entrega e pagamento ainda não foram definidos no carrinho")
    void shouldRejectCheckoutWhenDeliveryAndPaymentAreMissing() {
        cartService.addItem("customer-3", productRepository.findBySku("SKU-EC-01").orElseThrow().getId(), 1);

        assertThatThrownBy(() -> checkoutService.checkout("customer-3"))
                .isInstanceOf(com.portfolio.saas.common.exception.BusinessException.class)
                .hasMessageContaining("forma de entrega");
    }

    @Test
    @DisplayName("Deve bloquear a definição de entrega DELIVERY sem endereço, antes mesmo do checkout")
    void shouldRejectDeliveryUpdateWhenAddressIsMissingForDeliveryMethod() {
        cartService.addItem("customer-4", productRepository.findBySku("SKU-EC-01").orElseThrow().getId(), 1);

        assertThatThrownBy(() -> cartService.updateDelivery("customer-4", null, "DELIVERY", "PIX"))
                .isInstanceOf(com.portfolio.saas.common.exception.BusinessException.class)
                .hasMessageContaining("endereço");
    }

    @Test
    @DisplayName("Deve concluir checkout com entrega DELIVERY e persistir endereço/pagamento no pedido")
    void shouldPersistDeliveryAndPaymentOnOrderAfterCheckout() {
        cartService.addItem("customer-5", productRepository.findBySku("SKU-EC-01").orElseThrow().getId(), 1);
        cartService.updateDelivery("customer-5", "Rua das Palmeiras, 482", "DELIVERY", "CREDIT_CARD");

        var order = checkoutService.checkout("customer-5");

        assertThat(order.deliveryAddress()).isEqualTo("Rua das Palmeiras, 482");
        assertThat(order.paymentMethod()).isEqualTo("CREDIT_CARD");
    }
}
