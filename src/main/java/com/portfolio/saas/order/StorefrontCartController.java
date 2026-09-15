package com.portfolio.saas.order;

import com.portfolio.saas.order.dto.CartDeliveryRequest;
import com.portfolio.saas.order.dto.CartResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Carrinho público do storefront (sem autenticação). Espelha o CartController interno,
 * mas em path próprio — nunca reaproveita o CartController autenticado, para não abrir
 * seus endpoints a chamadas anônimas.
 */
@RestController
@RequestMapping("/api/v1/storefront/cart")
@Tag(name = "Storefront - Carrinho", description = "Carrinho de compras público do storefront")
public class StorefrontCartController {

    private final CartService cartService;

    public StorefrontCartController(CartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping("/{customerId}")
    @Operation(summary = "Consultar carrinho")
    public ResponseEntity<CartResponse> getCart(@PathVariable String customerId) {
        return ResponseEntity.ok(cartService.getCart(customerId));
    }

    @PostMapping("/{customerId}/items")
    @Operation(summary = "Adicionar item ao carrinho")
    public ResponseEntity<CartResponse> addItem(@PathVariable String customerId, @Valid @RequestBody Map<String, Object> payload) {
        Integer quantity = payload.get("quantity") instanceof Number number ? number.intValue() : null;
        String productId = payload.get("productId") != null ? payload.get("productId").toString() : null;
        return ResponseEntity.ok(cartService.addItem(customerId, productId, quantity));
    }

    @PutMapping("/{customerId}/items/{productId}")
    @Operation(summary = "Atualizar quantidade")
    public ResponseEntity<CartResponse> updateQuantity(@PathVariable String customerId, @PathVariable String productId, @Valid @RequestBody Map<String, Object> payload) {
        Integer quantity = payload.get("quantity") instanceof Number number ? number.intValue() : null;
        return ResponseEntity.ok(cartService.updateQuantity(customerId, productId, quantity));
    }

    @DeleteMapping("/{customerId}/items/{productId}")
    @Operation(summary = "Remover item")
    public ResponseEntity<CartResponse> removeItem(@PathVariable String customerId, @PathVariable String productId) {
        return ResponseEntity.ok(cartService.removeItem(customerId, productId));
    }

    @DeleteMapping("/{customerId}")
    @Operation(summary = "Limpar carrinho")
    public ResponseEntity<Void> clearCart(@PathVariable String customerId) {
        cartService.clearCart(customerId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{customerId}/delivery")
    @Operation(summary = "Definir entrega e pagamento")
    public ResponseEntity<CartResponse> updateDelivery(@PathVariable String customerId, @Valid @RequestBody CartDeliveryRequest request) {
        return ResponseEntity.ok(cartService.updateDelivery(customerId, request.address(), request.shippingMethod(), request.paymentMethod()));
    }
}
