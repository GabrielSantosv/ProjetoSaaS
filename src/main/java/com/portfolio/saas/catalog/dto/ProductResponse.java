package com.portfolio.saas.catalog.dto;

import com.portfolio.saas.catalog.Product;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ProductResponse(
        String id,
        String tenantId,
        String sku,
        String name,
        BigDecimal price,
        Integer stockQuantity,
        String categoryId,
        String categoryName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static ProductResponse fromEntity(Product product) {
        if (product == null) return null;
        String catId = product.getCategory() != null ? product.getCategory().getId() : null;
        String catName = product.getCategory() != null ? product.getCategory().getName() : null;

        return new ProductResponse(
                product.getId(),
                product.getTenantId(),
                product.getSku(),
                product.getName(),
                product.getPrice(),
                product.getStockQuantity(),
                catId,
                catName,
                product.getCreatedAt(),
                product.getUpdatedAt()
        );
    }
}
