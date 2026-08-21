package com.portfolio.saas.pdv;

import com.portfolio.saas.order.OrderChannel;
import com.portfolio.saas.order.OrderService;
import com.portfolio.saas.order.dto.CreateOrderRequest;
import com.portfolio.saas.order.dto.OrderResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pdv")
@Tag(name = "PDV", description = "Vendas diretas no caixa")
@SecurityRequirement(name = "bearerAuth")
public class PdvController {

    private final OrderService orderService;

    public PdvController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping("/sales")
    @Operation(summary = "Registrar venda direta no PDV", description = "Cria um pedido de canal PDV e debita o estoque dos itens")
    public ResponseEntity<OrderResponse> createSale(@Valid @RequestBody CreateOrderRequest request) {
        CreateOrderRequest normalized = new CreateOrderRequest(
                request.customerId(),
                OrderChannel.PDV,
                request.items()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(orderService.createOrder(normalized));
    }
}
