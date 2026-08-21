package com.portfolio.saas.pdv;

import com.portfolio.saas.catalog.Product;
import com.portfolio.saas.catalog.ProductService;
import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.order.OrderService;
import com.portfolio.saas.order.dto.CreateOrderRequest;
import com.portfolio.saas.order.dto.OrderItemRequest;
import com.portfolio.saas.order.dto.OrderResponse;
import com.portfolio.saas.pdv.dto.AddTableItemRequest;
import com.portfolio.saas.pdv.dto.OpenTableRequest;
import com.portfolio.saas.pdv.dto.PdvTableSessionResponse;
import jakarta.persistence.OptimisticLockException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class PdvTableService {

    private final ProductService productService;
    private final OrderService orderService;
    private final RestaurantTableRepository restaurantTableRepository;
    private final RestaurantTableItemRepository restaurantTableItemRepository;

    public PdvTableService(ProductService productService,
                          OrderService orderService,
                          RestaurantTableRepository restaurantTableRepository,
                          RestaurantTableItemRepository restaurantTableItemRepository) {
        this.productService = productService;
        this.orderService = orderService;
        this.restaurantTableRepository = restaurantTableRepository;
        this.restaurantTableItemRepository = restaurantTableItemRepository;
    }

    @Transactional
    public PdvTableSessionResponse openTable(OpenTableRequest request) {
        if (request == null) {
            throw new BusinessException("Dados da mesa são obrigatórios.");
        }
        if (request.tableNumber() == null || request.tableNumber().isBlank()) {
            throw new BusinessException("O número da mesa é obrigatório.");
        }
        if (request.customerName() == null || request.customerName().isBlank()) {
            throw new BusinessException("O nome do cliente é obrigatório.");
        }

        Integer tableNumber = extractTableNumber(request.tableNumber());

        if (restaurantTableRepository.findByTenantIdAndNumber(getCurrentTenantId(), tableNumber).isPresent()) {
            throw new BusinessException("Já existe uma mesa aberta com este número para o tenant atual.");
        }

        String customerId = buildCustomerId(tableNumber);
        RestaurantTable table = new RestaurantTable(tableNumber, request.customerName(), customerId);
        table = restaurantTableRepository.save(table);
        return toResponse(table);
    }

    @Transactional
    public PdvTableSessionResponse addItem(String tableId, AddTableItemRequest request) {
        RestaurantTable table = getTableSession(tableId);
        if (request == null || request.productId() == null || request.productId().isBlank()) {
            throw new BusinessException("O identificador do produto é obrigatório.");
        }
        if (request.quantity() == null || request.quantity() <= 0) {
            throw new BusinessException("A quantidade do item deve ser maior que zero.");
        }
        if (table.getStatus() == PdvTableStatus.CLOSED) {
            throw new BusinessException("A mesa está fechada e não pode receber novos itens.");
        }

        Product product = productService.getProductEntityById(request.productId());
        if (product.getStockQuantity() < request.quantity()) {
            throw new BusinessException(String.format(
                    "Estoque insuficiente para o produto '%s'. Estoque atual: %d, quantidade solicitada: %d",
                    product.getName(), product.getStockQuantity(), request.quantity()
            ));
        }

        Optional<RestaurantTableItem> existing = table.getItems().stream()
                .filter(item -> item.getProductId().equals(product.getId()))
                .findFirst();

        if (existing.isPresent()) {
            RestaurantTableItem item = existing.get();
            item.setQuantity(item.getQuantity() + request.quantity());
        } else {
            RestaurantTableItem item = new RestaurantTableItem(table, product.getId(), product.getName(), request.quantity(), product.getPrice());
            table.getItems().add(item);
            restaurantTableItemRepository.save(item);
        }

        BigDecimal total = table.getItems().stream()
                .map(item -> item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        table.setTotal(total);

        restaurantTableRepository.saveAndFlush(table);
        return toResponse(table);
    }

    @Transactional
    public PdvTableSessionResponse closeTable(String tableId) {
        RestaurantTable table = getTableSession(tableId);
        if (table.getStatus() == PdvTableStatus.CLOSED) {
            return toResponse(table);
        }
        if (table.getItems().isEmpty()) {
            throw new BusinessException("A mesa não possui itens para fechar.");
        }

        try {
            RestaurantTable lockedTable = restaurantTableRepository.findByIdWithItemsForVersionCheck(tableId)
                    .orElseThrow(() -> new BusinessException("Mesa não encontrada."));

            if (lockedTable.getStatus() == PdvTableStatus.CLOSED) {
                return toResponse(lockedTable);
            }

            List<OrderItemRequest> items = lockedTable.getItems().stream()
                    .map(item -> new OrderItemRequest(item.getProductId(), item.getQuantity()))
                    .toList();

            String tableCustomerId = lockedTable.getCustomerId();
            OrderResponse response = orderService.createOrder(new CreateOrderRequest(
                    tableCustomerId,
                    com.portfolio.saas.order.OrderChannel.PDV,
                    items
            ));

            lockedTable.setOrderId(response.id());
            lockedTable.setStatus(PdvTableStatus.CLOSED);
            lockedTable.setClosedAt(LocalDateTime.now());
            lockedTable.setTotal(lockedTable.getItems().stream()
                    .map(item -> item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add));

            restaurantTableRepository.saveAndFlush(lockedTable);
            return toResponse(lockedTable);
        } catch (OptimisticLockingFailureException | OptimisticLockException ex) {
            throw new BusinessException("A mesa está sendo fechada por outro terminal. Tente novamente em instantes.");
        }
    }

    private RestaurantTable getTableSession(String tableId) {
        if (tableId == null || tableId.isBlank()) {
            throw new BusinessException("O identificador da mesa é obrigatório.");
        }
        return restaurantTableRepository.findById(tableId)
                .orElseThrow(() -> new BusinessException("Mesa não encontrada."));
    }

    private String getCurrentTenantId() {
        return com.portfolio.saas.tenant.TenantContext.getTenantId();
    }

    private Integer extractTableNumber(String rawTableNumber) {
        if (rawTableNumber == null || rawTableNumber.isBlank()) {
            throw new BusinessException("O número da mesa é obrigatório.");
        }

        String digits = rawTableNumber.replaceAll("[^0-9]", "");
        if (digits.isBlank()) {
            throw new BusinessException("O número da mesa deve conter um valor numérico válido.");
        }

        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException ex) {
            throw new BusinessException("O número da mesa deve conter um valor numérico válido.");
        }
    }

    private String buildCustomerId(Integer tableNumber) {
        String suffix = java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return "table-" + tableNumber + "-" + suffix;
    }

    private PdvTableSessionResponse toResponse(RestaurantTable table) {
        return new PdvTableSessionResponse(
                table.getId(),
                "Mesa " + table.getNumber(),
                table.getCustomerName(),
                table.getStatus(),
                table.getTotal(),
                table.getOrderId()
        );
    }
}
