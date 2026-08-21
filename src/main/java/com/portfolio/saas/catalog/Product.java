package com.portfolio.saas.catalog;

import com.portfolio.saas.common.audit.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;

/**
 * Entidade de Produto dentro do catálogo de um Tenant.
 * Possui SKU único por tenant para suportar o fluxo normal e o fluxo de importação massiva com upsert.
 */
@Entity
@Table(name = "products")
public class Product extends BaseEntity {

    @Column(name = "sku", length = 60, nullable = false)
    private String sku;

    @Column(name = "name", length = 150, nullable = false)
    private String name;

    @Column(name = "price", precision = 12, scale = 2, nullable = false)
    private BigDecimal price;

    @Column(name = "stock_quantity", nullable = false)
    private Integer stockQuantity = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    public Product() {
        super();
    }

    public Product(String sku, String name, BigDecimal price, Integer stockQuantity, Category category) {
        super();
        this.sku = sku;
        this.name = name;
        this.price = price;
        this.stockQuantity = stockQuantity != null ? stockQuantity : 0;
        this.category = category;
    }

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public Integer getStockQuantity() {
        return stockQuantity;
    }

    public void setStockQuantity(Integer stockQuantity) {
        this.stockQuantity = stockQuantity;
    }

    public Category getCategory() {
        return category;
    }

    public void setCategory(Category category) {
        this.category = category;
    }
}
