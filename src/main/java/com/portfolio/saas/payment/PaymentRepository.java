package com.portfolio.saas.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, String> {

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
}
