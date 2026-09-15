package com.portfolio.saas.order;

import com.portfolio.saas.order.dto.OrderResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Checkout público do storefront (sem autenticação). Espelha o CheckoutController interno
 * em path próprio, sem corpo — entrega e pagamento já foram persistidos no carrinho via
 * StorefrontCartController#updateDelivery antes desta chamada.
 */
@RestController
@RequestMapping("/api/v1/storefront/checkout")
@Tag(name = "Storefront - Checkout", description = "Conversão do carrinho em pedido no storefront público")
public class StorefrontCheckoutController {

    private final CheckoutService checkoutService;

    public StorefrontCheckoutController(CheckoutService checkoutService) {
        this.checkoutService = checkoutService;
    }

    @PostMapping("/{customerId}")
    @Operation(summary = "Finalizar compra")
    public ResponseEntity<OrderResponse> checkout(@PathVariable String customerId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(checkoutService.checkout(customerId));
    }
}
