package com.portfolio.saas.catalog.dto;

import com.portfolio.saas.catalog.ProductStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ProductRequest(
        @NotBlank(message = "O SKU do produto é obrigatório")
        @Size(max = 60, message = "O SKU deve ter no máximo 60 caracteres")
        String sku,

        @NotBlank(message = "O nome do produto é obrigatório")
        @Size(max = 150, message = "O nome do produto deve ter no máximo 150 caracteres")
        String name,

        @NotNull(message = "O preço é obrigatório")
        @DecimalMin(value = "0.01", message = "O preço deve ser maior que zero")
        BigDecimal price,

        @NotNull(message = "A quantidade em estoque é obrigatória")
        @Min(value = 0, message = "O estoque não pode ser negativo")
        Integer stockQuantity,

        String categoryId,

        @DecimalMin(value = "0.0", message = "O custo não pode ser negativo")
        BigDecimal cost,

        ProductStatus status,

        @Size(max = 500, message = "A descrição deve ter no máximo 500 caracteres")
        String description
) {
    public ProductRequest {
        if (cost == null) cost = BigDecimal.ZERO;
        if (status == null) status = ProductStatus.ACTIVE;
    }

    public ProductRequest(String sku, String name, BigDecimal price, Integer stockQuantity, String categoryId) {
        this(sku, name, price, stockQuantity, categoryId, null, null, null);
    }
}
