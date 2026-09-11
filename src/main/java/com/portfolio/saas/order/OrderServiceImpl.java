package com.portfolio.saas.order;

import com.portfolio.saas.catalog.Product;
import com.portfolio.saas.catalog.ProductService;
import com.portfolio.saas.catalog.dto.ProductResponse;
import com.portfolio.saas.common.dto.PageResponse;
import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.common.exception.ResourceNotFoundException;
import com.portfolio.saas.order.dto.CreateOrderRequest;
import com.portfolio.saas.order.dto.OrderItemRequest;
import com.portfolio.saas.order.dto.OrderListResponse;
import com.portfolio.saas.order.dto.OrderResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;
    private final ProductService productService;

    public OrderServiceImpl(OrderRepository orderRepository, ProductService productService) {
        this.orderRepository = orderRepository;
        this.productService = productService;
    }

    @Override
    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request) {
        if (request == null || request.items() == null || request.items().isEmpty()) {
            throw new BusinessException("O pedido deve conter ao menos um item.");
        }
        if (request.customerId() == null || request.customerId().isBlank()) {
            throw new BusinessException("O identificador do cliente é obrigatório.");
        }

        Order order = new Order(request.customerId(), OrderStatus.PENDING, BigDecimal.ZERO, request.channel());
        BigDecimal total = BigDecimal.ZERO;

        for (OrderItemRequest itemRequest : request.items()) {
            if (itemRequest == null || itemRequest.productId() == null || itemRequest.productId().isBlank()) {
                throw new BusinessException("Cada item do pedido precisa informar um produto válido.");
            }
            if (itemRequest.quantity() == null || itemRequest.quantity() <= 0) {
                throw new BusinessException("A quantidade do item deve ser maior que zero.");
            }

            Product product = productService.getProductEntityById(itemRequest.productId());
            if (product.getStockQuantity() < itemRequest.quantity()) {
                throw new BusinessException(String.format(
                        "Estoque insuficiente para o produto '%s'. Estoque atual: %d, quantidade solicitada: %d",
                        product.getName(), product.getStockQuantity(), itemRequest.quantity()
                ));
            }

            ProductResponse updatedProduct = productService.updateStock(product.getId(), -itemRequest.quantity());
            BigDecimal subtotal = product.getPrice().multiply(BigDecimal.valueOf(itemRequest.quantity()));

            OrderItem orderItem = new OrderItem(order, product, itemRequest.quantity(), product.getPrice(), subtotal);
            order.addItem(orderItem);
            total = total.add(subtotal);
        }

        order.setStatus(OrderStatus.CONFIRMED);
        order.setTotal(total);

        Order persistedOrder = orderRepository.save(order);
        return OrderResponse.fromEntity(persistedOrder);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<OrderResponse> getOrdersByCustomer(String customerId, Pageable pageable) {
        if (customerId == null || customerId.isBlank()) {
            throw new BusinessException("O identificador do cliente é obrigatório.");
        }

        Page<Order> orderPage = orderRepository.findByCustomerId(customerId, pageable);
        return PageResponse.fromPage(orderPage.map(OrderResponse::fromEntity));
    }

    @Override
    @Transactional(readOnly = true)
    public OrderListResponse getOrdersForAdmin(String status, String channel, String search, Pageable pageable) {
        OrderStatus statusFilter = (status == null || status.isBlank()) ? null : OrderStatus.valueOf(status);
        OrderChannel channelFilter = (channel == null || channel.isBlank()) ? null : OrderChannel.valueOf(channel);
        String searchFilter = (search == null || search.isBlank()) ? null : search.trim();

        Page<Order> orderPage = orderRepository.findFiltered(statusFilter, channelFilter, searchFilter, pageable);
        PageResponse<OrderResponse> page = PageResponse.fromPage(orderPage.map(OrderResponse::fromEntity));

        // Contagens agregadas no banco, respeitando o mesmo filtro de canal/busca da página
        // atual — nunca inferir "total por status" a partir de uma página parcial.
        Map<String, Long> counts = new LinkedHashMap<>();
        for (OrderStatus s : OrderStatus.values()) {
            counts.put(s.name(), 0L);
        }
        long total = 0L;
        for (OrderRepository.StatusCount statusCount : orderRepository.countByStatusFiltered(channelFilter, searchFilter)) {
            counts.put(statusCount.getStatus().name(), statusCount.getCount());
            total += statusCount.getCount();
        }
        counts.put("TOTAL", total);

        return new OrderListResponse(page, counts);
    }

    @Override
    @Transactional(readOnly = true)
    public OrderResponse getOrderById(String id) {
        return OrderResponse.fromEntity(getOrderEntityById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Order getOrderEntityById(String id) {
        return orderRepository.findByIdScoped(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pedido não encontrado com o ID: " + id));
    }

    @Override
    @Transactional
    public OrderResponse cancelOrder(String id) {
        Order order = getOrderEntityById(id);

        if (order.getStatus() == OrderStatus.CANCELLED) {
            return OrderResponse.fromEntity(order);
        }

        for (OrderItem item : order.getItems()) {
            if (item.getProduct() != null) {
                productService.updateStock(item.getProduct().getId(), item.getQuantity());
            }
        }

        order.setStatus(OrderStatus.CANCELLED);
        order = orderRepository.save(order);
        return OrderResponse.fromEntity(order);
    }
}
