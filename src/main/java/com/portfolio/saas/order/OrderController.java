package com.portfolio.saas.order;

import com.portfolio.saas.common.dto.PageResponse;
import com.portfolio.saas.order.dto.CreateOrderRequest;
import com.portfolio.saas.order.dto.OrderListResponse;
import com.portfolio.saas.order.dto.OrderResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/orders")
@Tag(name = "Pedidos", description = "Gestão central de pedidos do SaaS")
@SecurityRequirement(name = "bearerAuth")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    @Operation(summary = "Criar pedido", description = "Cria um novo pedido a partir de itens do catálogo")
    public ResponseEntity<OrderResponse> createOrder(@Valid @RequestBody CreateOrderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(orderService.createOrder(request));
    }

    @GetMapping
    @Operation(summary = "Listar pedidos do cliente", description = "Retorna os pedidos de um cliente específico")
    public ResponseEntity<PageResponse<OrderResponse>> getOrdersByCustomer(
            @RequestParam String customerId,
            Pageable pageable
    ) {
        return ResponseEntity.ok(orderService.getOrdersByCustomer(customerId, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Buscar pedido por id", description = "Retorna detalhes de um pedido")
    public ResponseEntity<OrderResponse> getOrderById(@PathVariable String id) {
        return ResponseEntity.ok(orderService.getOrderById(id));
    }

    @GetMapping("/admin")
    @Operation(summary = "Listar pedidos do tenant (administrativo)", description = "Retorna todos os pedidos do tenant autenticado, dos canais e-commerce e PDV, com paginação e filtro opcional por status/canal/busca")
    public ResponseEntity<OrderListResponse> getOrdersForAdmin(
            @Parameter(description = "Status do pedido para filtro (PENDING, CONFIRMED, CANCELLED, COMPLETED)") @RequestParam(required = false) String status,
            @Parameter(description = "Canal do pedido para filtro (ECOMMERCE, PDV)") @RequestParam(required = false) String channel,
            @Parameter(description = "Termo de busca por id do pedido ou id do cliente") @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(orderService.getOrdersForAdmin(status, channel, search, pageable));
    }
}
