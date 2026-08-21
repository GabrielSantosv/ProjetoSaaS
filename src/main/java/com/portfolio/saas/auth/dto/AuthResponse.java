package com.portfolio.saas.auth.dto;

public record AuthResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        UserResponse user,
        TenantResponse tenant
) {
    public AuthResponse(String accessToken, long expiresIn, UserResponse user, TenantResponse tenant) {
        this(accessToken, "Bearer", expiresIn, user, tenant);
    }
}
