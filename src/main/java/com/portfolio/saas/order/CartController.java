package com.portfolio.saas.order;

import com.portfolio.saas.order.dto.CartDeliveryRequest;
import com.portfolio.saas.order.dto.CartResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
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

@RestController
@RequestMapping("/api/v1/ecommerce")
@Tag(name = "E-commerce", description = "Carrinho de compras do cliente")
@SecurityRequirement(name = "bearerAuth")
public class CartController {

    private final CartService cartService;

    public CartController(CartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping("/cart/{customerId}")
    @Operation(summary = "Consultar carrinho", description = "Retorna os itens do carrinho do cliente")
    public ResponseEntity<CartResponse> getCart(@PathVariable String customerId) {
        return ResponseEntity.ok(cartService.getCart(customerId));
    }

    @PostMapping("/cart/{customerId}/items")
    @Operation(summary = "Adicionar item ao carrinho", description = "Adiciona um produto ao carrinho de compras")
    public ResponseEntity<CartResponse> addItem(@PathVariable String customerId, @Valid @RequestBody Map<String, Object> payload) {
        Integer quantity = payload.get("quantity") instanceof Number number ? number.intValue() : null;
        String productId = payload.get("productId") != null ? payload.get("productId").toString() : null;
        return ResponseEntity.ok(cartService.addItem(customerId, productId, quantity));
    }

    @PutMapping("/cart/{customerId}/items/{productId}")
    @Operation(summary = "Atualizar quantidade", description = "Altera a quantidade de um item do carrinho")
    public ResponseEntity<CartResponse> updateQuantity(@PathVariable String customerId, @PathVariable String productId, @Valid @RequestBody Map<String, Object> payload) {
        Integer quantity = payload.get("quantity") instanceof Number number ? number.intValue() : null;
        return ResponseEntity.ok(cartService.updateQuantity(customerId, productId, quantity));
    }

    @DeleteMapping("/cart/{customerId}/items/{productId}")
    @Operation(summary = "Remover item", description = "Remove um item do carrinho do cliente")
    public ResponseEntity<CartResponse> removeItem(@PathVariable String customerId, @PathVariable String productId) {
        return ResponseEntity.ok(cartService.removeItem(customerId, productId));
    }

    @DeleteMapping("/cart/{customerId}")
    @Operation(summary = "Limpar carrinho", description = "Remove todos os itens do carrinho do cliente")
    public ResponseEntity<Void> clearCart(@PathVariable String customerId) {
        cartService.clearCart(customerId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/cart/{customerId}/delivery")
    @Operation(summary = "Definir entrega e pagamento", description = "Registra endereço de entrega, forma de entrega e forma de pagamento do carrinho antes do checkout")
    public ResponseEntity<CartResponse> updateDelivery(@PathVariable String customerId, @Valid @RequestBody CartDeliveryRequest request) {
        return ResponseEntity.ok(cartService.updateDelivery(customerId, request.address(), request.shippingMethod(), request.paymentMethod()));
    }
}
