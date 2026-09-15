package com.portfolio.saas.tenant;

import com.portfolio.saas.auth.dto.TenantResponse;
import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.common.exception.ResourceNotFoundException;
import com.portfolio.saas.tenant.dto.TenantUpdateRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TenantServiceImpl implements TenantService {

    private final TenantRepository tenantRepository;

    public TenantServiceImpl(TenantRepository tenantRepository) {
        this.tenantRepository = tenantRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public TenantResponse getCurrentTenant() {
        return TenantResponse.fromTenant(getCurrentTenantEntity());
    }

    @Override
    @Transactional
    public TenantResponse updateCurrentTenant(TenantUpdateRequest request) {
        Tenant tenant = getCurrentTenantEntity();

        if (!tenant.getDocument().equalsIgnoreCase(request.document()) && tenantRepository.existsByDocument(request.document())) {
            throw new BusinessException("Já existe uma empresa cadastrada com o documento informado: " + request.document());
        }

        tenant.setName(request.name());
        tenant.setDocument(request.document());
        tenant.setPlanId(request.planId());

        tenant = tenantRepository.save(tenant);
        return TenantResponse.fromTenant(tenant);
    }

    private Tenant getCurrentTenantEntity() {
        return tenantRepository.findById(TenantContext.getTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Empresa não encontrada para o tenant atual."));
    }
}
