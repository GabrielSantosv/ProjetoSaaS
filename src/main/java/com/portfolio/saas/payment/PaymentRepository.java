package com.portfolio.saas.payment;

import com.portfolio.saas.order.OrderChannel;
import com.portfolio.saas.order.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, String> {

    interface ChannelTotal {
        OrderChannel getChannel();
        BigDecimal getTotal();
    }

    interface DayTotal {
        LocalDate getDay();
        BigDecimal getTotal();
    }

    @Query("SELECT p FROM Payment p WHERE p.tenantId = :tenantId ORDER BY p.createdAt DESC")
    List<Payment> findAllByTenantId(@Param("tenantId") String tenantId);

    @Query("SELECT p FROM Payment p WHERE p.order.id = :orderId")
    List<Payment> findByOrderId(@Param("orderId") String orderId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.order.id = :orderId")
    BigDecimal sumByOrderId(@Param("orderId") String orderId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.tenantId = :tenantId AND p.method = :method AND p.createdAt >= :fromDate")
    BigDecimal sumByTenantIdAndMethodAndCreatedAtGreaterThanEqual(
            @Param("tenantId") String tenantId,
            @Param("method") PaymentMethod method,
            @Param("fromDate") LocalDateTime fromDate
    );

    /**
     * Faturamento agregado dos dois canais reais (e-commerce + PDV) — não filtra por
     * canal porque OrderChannel só tem esses dois valores hoje, então a soma
     * irrestrita já é a soma dos dois canais. Só conta pedidos em status que
     * representam venda efetiva (nunca CANCELLED; ver ReportServiceImpl para a
     * lista exata de status considerados).
     */
    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p " +
            "WHERE p.order.status IN :statuses AND p.createdAt >= :from AND p.createdAt < :to")
    BigDecimal sumEffectiveRevenueInRange(
            @Param("statuses") List<OrderStatus> statuses,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );

    @Query("SELECT p.order.channel as channel, COALESCE(SUM(p.amount), 0) as total FROM Payment p " +
            "WHERE p.order.status IN :statuses AND p.createdAt >= :from AND p.createdAt < :to " +
            "GROUP BY p.order.channel")
    List<ChannelTotal> sumEffectiveRevenueByChannelInRange(
            @Param("statuses") List<OrderStatus> statuses,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );

    @Query("SELECT FUNCTION('DATE', p.createdAt) as day, COALESCE(SUM(p.amount), 0) as total FROM Payment p " +
            "WHERE p.order.status IN :statuses AND p.createdAt >= :from AND p.createdAt < :to " +
            "GROUP BY FUNCTION('DATE', p.createdAt) " +
            "ORDER BY FUNCTION('DATE', p.createdAt)")
    List<DayTotal> sumEffectiveRevenueByDayInRange(
            @Param("statuses") List<OrderStatus> statuses,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );
}
