package com.portfolio.saas.tenant;

import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.stereotype.Component;

/**
 * Integrador com o mecanismo de @TenantId do Hibernate 6.4+.
 * Sempre que o Hibernate vai persistir ou consultar uma entidade anotada com @TenantId,
 * ele consulta esta classe para saber qual tenant_id aplicar na cláusula WHERE ou INSERT.
 */
@Component
public class TenantIdentifierResolver implements CurrentTenantIdentifierResolver<String> {

    public static final String BOOTSTRAP_SYSTEM = "BOOTSTRAP_SYSTEM";

    @Override
    public String resolveCurrentTenantIdentifier() {
        String tenantId = TenantContext.getTenantId();
        return (tenantId != null && !tenantId.isBlank()) ? tenantId : BOOTSTRAP_SYSTEM;
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return false;
    }
}
