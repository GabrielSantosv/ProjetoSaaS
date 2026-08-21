package com.portfolio.saas.tenant;

/**
 * Contexto da requisição que armazena o identificador do Tenant atual.
 * Utiliza ThreadLocal para isolamento seguro por thread e nunca aceita tenantId
 * vindo de body ou query string — o tenantId provém unicamente da autenticação JWT.
 */
public final class TenantContext {

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    private TenantContext() {
        // Construtor privado para classe utilitária
    }

    public static void setTenantId(String tenantId) {
        CURRENT_TENANT.set(tenantId);
    }

    public static String getTenantId() {
        return CURRENT_TENANT.get();
    }

    public static boolean hasTenant() {
        return CURRENT_TENANT.get() != null && !CURRENT_TENANT.get().isBlank();
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
