package com.portfolio.saas.cashier;

import com.portfolio.saas.common.audit.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "cash_registers")
public class CashRegister extends BaseEntity {

    @Column(name = "opened_at", nullable = false)
    private LocalDateTime openedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "total_cash", precision = 12, scale = 2, nullable = false)
    private BigDecimal totalCash = BigDecimal.ZERO;

    @Column(name = "total_card", precision = 12, scale = 2, nullable = false)
    private BigDecimal totalCard = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30, nullable = false)
    private CashRegisterStatus status = CashRegisterStatus.OPEN;

    @Column(name = "open_marker", length = 36, nullable = true)
    private String openMarker;

    public CashRegister() {
        super();
    }

    public CashRegister(LocalDateTime openedAt) {
        this.openedAt = openedAt;
        this.status = CashRegisterStatus.OPEN;
    }

    public LocalDateTime getOpenedAt() {
        return openedAt;
    }

    public void setOpenedAt(LocalDateTime openedAt) {
        this.openedAt = openedAt;
    }

    public LocalDateTime getClosedAt() {
        return closedAt;
    }

    public void setClosedAt(LocalDateTime closedAt) {
        this.closedAt = closedAt;
    }

    public BigDecimal getTotalCash() {
        return totalCash;
    }

    public void setTotalCash(BigDecimal totalCash) {
        this.totalCash = totalCash;
    }

    public BigDecimal getTotalCard() {
        return totalCard;
    }

    public void setTotalCard(BigDecimal totalCard) {
        this.totalCard = totalCard;
    }

    public CashRegisterStatus getStatus() {
        return status;
    }

    public void setStatus(CashRegisterStatus status) {
        this.status = status;
    }

    public String getOpenMarker() {
        return openMarker;
    }

    public void setOpenMarker(String openMarker) {
        this.openMarker = openMarker;
    }
}
