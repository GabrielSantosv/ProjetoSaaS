package com.portfolio.saas.order;

import com.portfolio.saas.catalog.Product;
import com.portfolio.saas.catalog.ProductService;
import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.order.dto.CartItemResponse;
import com.portfolio.saas.order.dto.CartResponse;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CartServiceImpl implements CartService {

    private static final Set<String> VALID_SHIPPING_METHODS = Set.of("DELIVERY", "PICKUP");
    private static final Set<String> VALID_PAYMENT_METHODS = Set.of("PIX", "CREDIT_CARD", "ON_DELIVERY");

    /**
     * Limitação conhecida do estágio atual: o carrinho é in-memory e não sobrevive a reinício,
     * não é compartilhado entre múltiplas instâncias do serviço e não tem TTL/persistência.
     * Isso é suficiente para o escopo do portfólio atual, mas não para escala horizontal.
     */
    private final ProductService productService;
    private final Map<String, Map<String, CartLine>> carts = new ConcurrentHashMap<>();
    private final Map<String, CartMeta> deliveryMeta = new ConcurrentHashMap<>();

    public CartServiceImpl(ProductService productService) {
        this.productService = productService;
    }

    @Override
    public CartResponse addItem(String customerId, String productId, Integer quantity) {
        validateCustomerAndProduct(customerId, productId, quantity);

        Product product = productService.getProductEntityById(productId);
        if (product.getStockQuantity() < quantity) {
            throw new BusinessException(String.format(
                    "Estoque insuficiente para o produto '%s'. Estoque atual: %d, quantidade solicitada: %d",
                    product.getName(), product.getStockQuantity(), quantity
            ));
        }

        Map<String, CartLine> cart = carts.computeIfAbsent(customerId, ignored -> new ConcurrentHashMap<>());
        CartLine line = cart.get(productId);

        if (line == null) {
            line = new CartLine(productId, quantity, product.getPrice());
            cart.put(productId, line);
        } else {
            line.quantity += quantity;
        }

        return buildCartResponse(customerId, cart);
    }

    @Override
    public CartResponse removeItem(String customerId, String productId) {
        if (customerId == null || customerId.isBlank()) {
            throw new BusinessException("O identificador do cliente é obrigatório.");
        }
        if (productId == null || productId.isBlank()) {
            throw new BusinessException("O identificador do produto é obrigatório.");
        }

        Map<String, CartLine> cart = carts.get(customerId);
        if (cart != null) {
            cart.remove(productId);
        }

        return getCart(customerId);
    }

    @Override
    public CartResponse updateQuantity(String customerId, String productId, Integer quantity) {
        validateCustomerAndProduct(customerId, productId, quantity);

        Map<String, CartLine> cart = carts.computeIfAbsent(customerId, ignored -> new ConcurrentHashMap<>());
        CartLine line = cart.get(productId);
        if (line == null) {
            throw new BusinessException("Produto não encontrado no carrinho do cliente.");
        }

        Product product = productService.getProductEntityById(productId);
        if (product.getStockQuantity() < quantity) {
            throw new BusinessException(String.format(
                    "Estoque insuficiente para o produto '%s'. Estoque atual: %d, quantidade solicitada: %d",
                    product.getName(), product.getStockQuantity(), quantity
            ));
        }

        line.quantity = quantity;
        return buildCartResponse(customerId, cart);
    }

    @Override
    public CartResponse updateDelivery(String customerId, String address, String shippingMethod, String paymentMethod) {
        if (customerId == null || customerId.isBlank()) {
            throw new BusinessException("O identificador do cliente é obrigatório.");
        }
        if (shippingMethod == null || !VALID_SHIPPING_METHODS.contains(shippingMethod)) {
            throw new BusinessException("Forma de entrega inválida.");
        }
        if (paymentMethod == null || !VALID_PAYMENT_METHODS.contains(paymentMethod)) {
            throw new BusinessException("Forma de pagamento inválida.");
        }
        if ("DELIVERY".equals(shippingMethod) && (address == null || address.isBlank())) {
            throw new BusinessException("O endereço de entrega é obrigatório para este tipo de entrega.");
        }

        String normalizedAddress = "PICKUP".equals(shippingMethod) ? null : address;
        deliveryMeta.put(customerId, new CartMeta(normalizedAddress, shippingMethod, paymentMethod));

        return getCart(customerId);
    }

    @Override
    public CartResponse getCart(String customerId) {
        if (customerId == null || customerId.isBlank()) {
            throw new BusinessException("O identificador do cliente é obrigatório.");
        }

        Map<String, CartLine> cart = carts.getOrDefault(customerId, Map.of());
        return buildCartResponse(customerId, cart);
    }

    @Override
    public void clearCart(String customerId) {
        if (customerId != null && !customerId.isBlank()) {
            carts.remove(customerId);
            deliveryMeta.remove(customerId);
        }
    }

    private void validateCustomerAndProduct(String customerId, String productId, Integer quantity) {
        if (customerId == null || customerId.isBlank()) {
            throw new BusinessException("O identificador do cliente é obrigatório.");
        }
        if (productId == null || productId.isBlank()) {
            throw new BusinessException("O identificador do produto é obrigatório.");
        }
        if (quantity == null || quantity <= 0) {
            throw new BusinessException("A quantidade do item deve ser maior que zero.");
        }
    }

    private CartResponse buildCartResponse(String customerId, Map<String, CartLine> cart) {
        List<CartItemResponse> items = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        for (Map.Entry<String, CartLine> entry : cart.entrySet()) {
            Product product = productService.getProductEntityById(entry.getKey());
            CartLine line = entry.getValue();
            BigDecimal subtotal = product.getPrice().multiply(BigDecimal.valueOf(line.quantity));
            total = total.add(subtotal);
            items.add(new CartItemResponse(product.getId(), product.getName(), product.getPrice(), line.quantity, subtotal));
        }

        CartMeta meta = deliveryMeta.get(customerId);
        String address = meta != null ? meta.address() : null;
        String shippingMethod = meta != null ? meta.shippingMethod() : null;
        String paymentMethod = meta != null ? meta.paymentMethod() : null;

        return new CartResponse(customerId, items, total, address, shippingMethod, paymentMethod);
    }

    private record CartMeta(String address, String shippingMethod, String paymentMethod) {}

    private static final class CartLine {
        private final String productId;
        private Integer quantity;
        private final BigDecimal unitPrice;

        private CartLine(String productId, Integer quantity, BigDecimal unitPrice) {
            if (quantity == null || quantity <= 0) {
                throw new IllegalArgumentException("Quantidade inválida no carrinho.");
            }
            this.productId = productId;
            this.quantity = quantity;
            this.unitPrice = unitPrice;
        }

        public String productId() {
            return productId;
        }

        public Integer quantity() {
            return quantity;
        }

        public BigDecimal unitPrice() {
            return unitPrice;
        }
    }
}
