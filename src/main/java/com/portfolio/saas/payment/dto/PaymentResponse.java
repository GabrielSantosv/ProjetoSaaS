package com.portfolio.saas.payment.dto;

import com.portfolio.saas.payment.Payment;
import com.portfolio.saas.payment.PaymentMethod;
import com.portfolio.saas.payment.PaymentStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PaymentResponse(
        String id,
        String tenantId,
        String orderId,
        PaymentMethod method,
        BigDecimal amount,
        PaymentStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static PaymentResponse fromEntity(Payment payment) {
        if (payment == null) return null;
        return new PaymentResponse(
                payment.getId(),
                payment.getTenantId(),
                payment.getOrder() != null ? payment.getOrder().getId() : null,
                payment.getMethod(),
                payment.getAmount(),
                payment.getStatus(),
                payment.getCreatedAt(),
                payment.getUpdatedAt()
        );
    }
}
