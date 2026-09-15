package com.portfolio.saas.catalog.dto;

import java.math.BigDecimal;

/**
 * Versão pública do produto, exposta em "/api/v1/storefront/**" sem autenticação.
 * Deliberadamente NÃO inclui cost, tenantId, sku, status ou timestamps — são dados
 * internos de gestão do catálogo, não deveriam vazar para um visitante anônimo.
 */
public record StorefrontProductResponse(
        String id,
        String name,
        BigDecimal price,
        Integer stockQuantity,
        String categoryId,
        String categoryName,
        String description
) {
    public static StorefrontProductResponse fromEntity(ProductResponse product) {
        if (product == null) return null;
        return new StorefrontProductResponse(
                product.id(),
                product.name(),
                product.price(),
                product.stockQuantity(),
                product.categoryId(),
                product.categoryName(),
                product.description()
        );
    }
}
