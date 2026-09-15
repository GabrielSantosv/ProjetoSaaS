package com.portfolio.saas.report;

import com.portfolio.saas.catalog.ProductRepository;
import com.portfolio.saas.catalog.ProductStatus;
import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.imports.ImportJobRepository;
import com.portfolio.saas.order.OrderChannel;
import com.portfolio.saas.order.OrderRepository;
import com.portfolio.saas.order.OrderStatus;
import com.portfolio.saas.payment.PaymentRepository;
import com.portfolio.saas.pdv.PdvTableStatus;
import com.portfolio.saas.pdv.RestaurantTableRepository;
import com.portfolio.saas.report.dto.DashboardReportResponse;
import com.portfolio.saas.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
public class ReportServiceImpl implements ReportService {

    /**
     * Status que representam venda efetiva para fins de relatório: nunca
     * CANCELLED. PENDING é o valor inicial em memória do Order, mas
     * OrderServiceImpl.createOrder() sempre sobrescreve para CONFIRMED antes
     * de persistir (único caminho de criação de pedido no sistema hoje) — ou
     * seja, PENDING nunca chega a existir de fato no banco no código atual.
     * Ainda assim é excluído aqui explicitamente por segurança semântica, caso
     * um fluxo futuro (ex.: carrinho abandonado) volte a persistir esse status.
     */
    private static final List<OrderStatus> EFFECTIVE_SALE_STATUSES = List.of(OrderStatus.CONFIRMED, OrderStatus.COMPLETED);

    private final PaymentRepository paymentRepository;
    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final ImportJobRepository importJobRepository;
    private final RestaurantTableRepository restaurantTableRepository;

    public ReportServiceImpl(PaymentRepository paymentRepository,
                              OrderRepository orderRepository,
                              ProductRepository productRepository,
                              ImportJobRepository importJobRepository,
                              RestaurantTableRepository restaurantTableRepository) {
        this.paymentRepository = paymentRepository;
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.importJobRepository = importJobRepository;
        this.restaurantTableRepository = restaurantTableRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public DashboardReportResponse getDashboard(ReportPeriod period) {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException("Tenant ativo obrigatório para consultar o relatório.");
        }
        if (period == null) {
            throw new BusinessException("O período do relatório é obrigatório.");
        }

        LocalDateTime[] range = resolveRange(period);
        LocalDateTime from = range[0];
        LocalDateTime to = range[1];

        BigDecimal faturamento = paymentRepository.sumEffectiveRevenueInRange(EFFECTIVE_SALE_STATUSES, from, to);
        long pedidos = orderRepository.countInRangeByStatuses(EFFECTIVE_SALE_STATUSES, from, to);
        BigDecimal ticketMedio = pedidos == 0
                ? BigDecimal.ZERO
                : faturamento.divide(BigDecimal.valueOf(pedidos), 2, RoundingMode.HALF_UP);

        long novosClientes = orderRepository.findNewEcommerceCustomerIdsInRange(from, to).size();

        DashboardReportResponse.RevenueByChannel receitaPorCanal = resolveRevenueByChannel(from, to);
        List<DashboardReportResponse.DailyRevenue> faturamentoPorDia = paymentRepository
                .sumEffectiveRevenueByDayInRange(EFFECTIVE_SALE_STATUSES, from, to)
                .stream()
                .map(row -> new DashboardReportResponse.DailyRevenue(row.getDay(), row.getTotal()))
                .toList();

        DashboardReportResponse.OperationalSummary operacional = resolveOperationalSummary();

        return new DashboardReportResponse(faturamento, pedidos, ticketMedio, novosClientes, receitaPorCanal, faturamentoPorDia, operacional);
    }

    private DashboardReportResponse.RevenueByChannel resolveRevenueByChannel(LocalDateTime from, LocalDateTime to) {
        Map<OrderChannel, BigDecimal> byChannel = new EnumMap<>(OrderChannel.class);
        for (OrderChannel channel : OrderChannel.values()) {
            byChannel.put(channel, BigDecimal.ZERO);
        }
        for (PaymentRepository.ChannelTotal row : paymentRepository.sumEffectiveRevenueByChannelInRange(EFFECTIVE_SALE_STATUSES, from, to)) {
            byChannel.put(row.getChannel(), row.getTotal());
        }
        return new DashboardReportResponse.RevenueByChannel(byChannel.get(OrderChannel.ECOMMERCE), byChannel.get(OrderChannel.PDV));
    }

    private DashboardReportResponse.OperationalSummary resolveOperationalSummary() {
        Map<String, Long> productCounts = new java.util.HashMap<>();
        for (ProductRepository.StatusCount sc : productRepository.countByStatusFiltered(null, null)) {
            productCounts.put(sc.getStatus().name(), sc.getCount());
        }
        long produtosAtivos = productCounts.getOrDefault(ProductStatus.ACTIVE.name(), 0L);
        long produtosSemEstoque = productCounts.getOrDefault(ProductStatus.OUT_OF_STOCK.name(), 0L);
        long produtosRascunho = productCounts.getOrDefault(ProductStatus.DRAFT.name(), 0L);

        LocalDate today = LocalDate.now();
        LocalDateTime startOfToday = today.atStartOfDay();
        LocalDateTime startOfTomorrow = today.plusDays(1).atStartOfDay();

        long arquivosImportadosHoje = importJobRepository.countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(startOfToday, startOfTomorrow);
        long linhasImportadasHoje = importJobRepository.sumSuccessCountInRange(startOfToday, startOfTomorrow);
        long linhasComErroHoje = importJobRepository.sumErrorCountInRange(startOfToday, startOfTomorrow);
        long mesasOcupadas = restaurantTableRepository.countByStatus(PdvTableStatus.OPEN);

        return new DashboardReportResponse.OperationalSummary(
                produtosAtivos, produtosSemEstoque, produtosRascunho, arquivosImportadosHoje, linhasImportadasHoje, linhasComErroHoje, mesasOcupadas);
    }

    /**
     * "Hoje" é o dia de calendário no fuso do servidor — este backend não guarda
     * fuso por tenant em lugar nenhum (Tenant não tem coluna de timezone), e o
     * resto do código já usa LocalDateTime.now() sem zona explícita (ver
     * CashRegisterServiceImpl, PdvTableService), então este método segue a mesma
     * convenção em vez de introduzir um mecanismo de fuso novo. Limites sempre
     * em [from, to) — início inclusivo, fim exclusivo à meia-noite do dia
     * seguinte — para não depender de comparação de fim de dia com
     * LocalTime.MAX (que ignora frações de segundo abaixo do nanossegundo e é
     * uma fonte clássica de bug de borda de meia-noite).
     */
    private LocalDateTime[] resolveRange(ReportPeriod period) {
        LocalDate today = LocalDate.now();
        LocalDateTime to = today.plusDays(1).atStartOfDay();
        LocalDateTime from = switch (period) {
            case TODAY -> today.atStartOfDay();
            case LAST_7_DAYS -> today.minusDays(6).atStartOfDay();
            case LAST_30_DAYS -> today.minusDays(29).atStartOfDay();
        };
        return new LocalDateTime[]{from, to};
    }
}
