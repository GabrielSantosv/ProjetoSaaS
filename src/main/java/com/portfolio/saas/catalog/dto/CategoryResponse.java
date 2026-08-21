package com.portfolio.saas.catalog.dto;

import com.portfolio.saas.catalog.Category;

import java.time.LocalDateTime;

public record CategoryResponse(
        String id,
        String tenantId,
        String name,
        String description,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static CategoryResponse fromEntity(Category category) {
        if (category == null) return null;
        return new CategoryResponse(
                category.getId(),
                category.getTenantId(),
                category.getName(),
                category.getDescription(),
                category.getCreatedAt(),
                category.getUpdatedAt()
        );
    }
}
