package com.portfolio.saas.tenant;

import com.portfolio.saas.auth.dto.TenantResponse;
import com.portfolio.saas.tenant.dto.TenantUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tenants")
@Tag(name = "Tenant", description = "Dados da empresa/loja do tenant autenticado")
@SecurityRequirement(name = "bearerAuth")
public class TenantController {

    private final TenantService tenantService;

    public TenantController(TenantService tenantService) {
        this.tenantService = tenantService;
    }

    @GetMapping("/me")
    @Operation(summary = "Dados do Tenant atual", description = "Retorna os dados da empresa/loja vinculada ao usuário autenticado")
    public ResponseEntity<TenantResponse> getCurrentTenant() {
        return ResponseEntity.ok(tenantService.getCurrentTenant());
    }

    @PutMapping("/me")
    @Operation(summary = "Atualizar dados do Tenant atual", description = "Atualiza razão social, documento e plano da empresa/loja vinculada ao usuário autenticado")
    public ResponseEntity<TenantResponse> updateCurrentTenant(@Valid @RequestBody TenantUpdateRequest request) {
        return ResponseEntity.ok(tenantService.updateCurrentTenant(request));
    }
}
