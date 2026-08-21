package com.portfolio.saas.pdv;

import java.math.BigDecimal;

public class PdvTableSessionItem {

    private final String productId;
    private final String productName;
    private final BigDecimal unitPrice;
    private final Integer quantity;

    public PdvTableSessionItem(String productId, String productName, BigDecimal unitPrice, Integer quantity) {
        this.productId = productId;
        this.productName = productName;
        this.unitPrice = unitPrice;
        this.quantity = quantity;
    }

    public String getProductId() {
        return productId;
    }

    public String getProductName() {
        return productName;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public Integer getQuantity() {
        return quantity;
    }
}
