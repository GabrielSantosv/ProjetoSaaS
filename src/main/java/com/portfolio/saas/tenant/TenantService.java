package com.portfolio.saas.tenant;

import com.portfolio.saas.auth.dto.TenantResponse;
import com.portfolio.saas.tenant.dto.TenantUpdateRequest;

public interface TenantService {

    TenantResponse getCurrentTenant();

    TenantResponse updateCurrentTenant(TenantUpdateRequest request);
}
