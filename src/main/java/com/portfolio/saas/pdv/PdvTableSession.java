package com.portfolio.saas.pdv;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class PdvTableSession {

    private final String id;
    private final String tableNumber;
    private final String customerName;
    private PdvTableStatus status;
    private BigDecimal total = BigDecimal.ZERO;
    private String orderId;
    private final List<PdvTableSessionItem> items = new ArrayList<>();

    public PdvTableSession(String id, String tableNumber, String customerName) {
        this.id = id;
        this.tableNumber = tableNumber;
        this.customerName = customerName;
        this.status = PdvTableStatus.OPEN;
    }

    public String getId() {
        return id;
    }

    public String getTableNumber() {
        return tableNumber;
    }

    public String getCustomerName() {
        return customerName;
    }

    public PdvTableStatus getStatus() {
        return status;
    }

    public void setStatus(PdvTableStatus status) {
        this.status = status;
    }

    public BigDecimal getTotal() {
        return total;
    }

    public void setTotal(BigDecimal total) {
        this.total = total;
    }

    public String getOrderId() {
        return orderId;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }

    public List<PdvTableSessionItem> getItems() {
        return items;
    }

    public void addItem(PdvTableSessionItem item) {
        this.items.add(item);
    }
}
