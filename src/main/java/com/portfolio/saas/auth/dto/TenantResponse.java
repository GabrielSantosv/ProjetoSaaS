package com.portfolio.saas.auth.dto;

import com.portfolio.saas.tenant.Tenant;

public record TenantResponse(
        String id,
        String name,
        String document,
        String planId,
        boolean active
) {
    public static TenantResponse fromTenant(Tenant tenant) {
        return new TenantResponse(
                tenant.getId(),
                tenant.getName(),
                tenant.getDocument(),
                tenant.getPlanId(),
                tenant.isActive()
        );
    }
}
