package com.portfolio.saas.tenant;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TenantContextTest {

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("Deve definir, consultar e limpar o tenantId no contexto da thread")
    void shouldSetGetAndClearTenantId() {
        assertThat(TenantContext.hasTenant()).isFalse();
        assertThat(TenantContext.getTenantId()).isNull();

        TenantContext.setTenantId("tenant-uuid-123");

        assertThat(TenantContext.hasTenant()).isTrue();
        assertThat(TenantContext.getTenantId()).isEqualTo("tenant-uuid-123");

        TenantContext.clear();

        assertThat(TenantContext.hasTenant()).isFalse();
        assertThat(TenantContext.getTenantId()).isNull();
    }
}
