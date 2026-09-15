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
import com.portfolio.saas.pdv.dto.PdvTableItemResponse;
import com.portfolio.saas.pdv.dto.PdvTableSessionResponse;
import jakarta.persistence.OptimisticLockException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

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

    @Transactional(readOnly = true)
    public List<PdvTableSessionResponse> listOpenTables() {
        return restaurantTableRepository.findByStatusOrderByNumberAsc(PdvTableStatus.OPEN).stream()
                .map(this::toResponse)
                .toList();
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

        // A constraint única (tenant_id, number) cobre a linha para sempre, não só enquanto
        // aberta — então uma mesa já usada e fechada precisa reaproveitar a mesma linha em vez
        // de tentar inserir outra, senão o número nunca mais poderia ser aberto (giro de mesas
        // é o uso normal de um restaurante, não uma exceção).
        var existing = restaurantTableRepository.findByTenantIdAndNumber(getCurrentTenantId(), tableNumber);
        if (existing.isPresent() && existing.get().getStatus() == PdvTableStatus.OPEN) {
            throw new BusinessException("Já existe uma mesa aberta com este número para o tenant atual.");
        }

        String customerId = buildCustomerId(tableNumber);
        RestaurantTable table;
        if (existing.isPresent()) {
            table = restaurantTableRepository.findByIdWithItems(existing.get().getId())
                    .orElseThrow(() -> new BusinessException("Mesa não encontrada."));
            table.getItems().clear();
            table.setCustomerName(request.customerName());
            table.setCustomerId(customerId);
            table.setStatus(PdvTableStatus.OPEN);
            table.setTotal(BigDecimal.ZERO);
            table.setOrderId(null);
            table.setOpenedAt(LocalDateTime.now());
            table.setClosedAt(null);
        } else {
            table = new RestaurantTable(tableNumber, request.customerName(), customerId);
        }
        try {
            table = restaurantTableRepository.saveAndFlush(table);
        } catch (OptimisticLockingFailureException | OptimisticLockException ex) {
            throw new BusinessException("Esta mesa acabou de ser aberta por outro terminal. Tente novamente.");
        }
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

        // Upsert atômico (INSERT ... ON DUPLICATE KEY UPDATE, protegido pela constraint
        // uq_table_item_product): evita tanto o OptimisticLockException de um save/saveAndFlush
        // da RestaurantTable versionada quanto a corrida de "duas linhas para o mesmo produto"
        // quando dois addItem concorrentes acertam a mesma mesa — inclusive no primeiro item
        // de uma comanda nova, quando a linha ainda não existe para nenhum dos dois.
        restaurantTableItemRepository.upsertItem(
                java.util.UUID.randomUUID().toString(),
                getCurrentTenantId(),
                tableId,
                product.getId(),
                product.getName(),
                request.quantity(),
                product.getPrice()
        );

        RestaurantTable refreshed = restaurantTableRepository.findByIdWithItems(tableId)
                .orElseThrow(() -> new BusinessException("Mesa não encontrada."));
        BigDecimal total = refreshed.getItems().stream()
                .map(item -> item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        restaurantTableRepository.updateTotalAtomic(tableId, total);
        refreshed.setTotal(total);

        return toResponse(refreshed);
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
        List<PdvTableItemResponse> items = table.getItems().stream()
                .map(item -> new PdvTableItemResponse(
                        item.getProductId(),
                        item.getProductName(),
                        item.getQuantity(),
                        item.getUnitPrice(),
                        item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity()))
                ))
                .toList();

        return new PdvTableSessionResponse(
                table.getId(),
                table.getNumber(),
                "Mesa " + table.getNumber(),
                table.getCustomerName(),
                table.getStatus(),
                table.getTotal(),
                table.getOrderId(),
                table.getOpenedAt(),
                items
        );
    }
}
