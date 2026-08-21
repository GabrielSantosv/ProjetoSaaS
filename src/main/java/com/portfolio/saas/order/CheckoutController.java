package com.portfolio.saas.order;

import com.portfolio.saas.order.dto.OrderResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/ecommerce")
@Tag(name = "Checkout", description = "Conversão do carrinho em pedido")
@SecurityRequirement(name = "bearerAuth")
public class CheckoutController {

    private final CheckoutService checkoutService;

    public CheckoutController(CheckoutService checkoutService) {
        this.checkoutService = checkoutService;
    }

    @PostMapping("/checkout/{customerId}")
    @Operation(summary = "Finalizar compra", description = "Converte o carrinho do cliente em um pedido confirmado")
    public ResponseEntity<OrderResponse> checkout(@PathVariable String customerId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(checkoutService.checkout(customerId));
    }
}
