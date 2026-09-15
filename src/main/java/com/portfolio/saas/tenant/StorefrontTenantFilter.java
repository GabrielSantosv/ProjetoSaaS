package com.portfolio.saas.tenant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Resolve o tenant para as rotas públicas do storefront ("/api/v1/storefront/**"),
 * que não têm JWT (não há login no storefront). Isolado do TenantFilter de propósito:
 * nunca toca no mecanismo de resolução via JWT usado por todo o resto da API, e só age
 * no prefixo de path do storefront — os demais requests passam direto, sem efeito algum.
 *
 * Registrado DEPOIS do TenantFilter na cadeia (addFilterAfter) — de propósito, não antes.
 * Um cliente pode enviar um JWT válido (de QUALQUER tenant) junto com uma chamada ao
 * storefront; o TenantFilter roda para toda requisição autenticada, sem saber que o path
 * é público, e setaria o TenantContext para o tenant do JWT. Rodando depois, este filtro
 * tem a palavra final e sobrescreve isso incondicionalmente para o tenant fixo configurado
 * — o storefront nunca deve refletir o tenant de um JWT alheio, só o tenant fixo, ponto.
 * (Bug real encontrado e corrigido em auditoria: sem essa ordem, um JWT válido de outro
 * tenant fazia o storefront vazar o catálogo desse outro tenant.)
 */
@Component
public class StorefrontTenantFilter extends OncePerRequestFilter {

    private static final String STOREFRONT_PATH_PREFIX = "/api/v1/storefront/";

    private final String storefrontTenantId;

    public StorefrontTenantFilter(@Value("${storefront.tenant-id:}") String storefrontTenantId) {
        this.storefrontTenantId = storefrontTenantId;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        if (!request.getRequestURI().startsWith(STOREFRONT_PATH_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        if (storefrontTenantId == null || storefrontTenantId.isBlank()) {
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.setContentType("application/json");
            response.getWriter().write(
                    "{\"message\":\"O storefront não está configurado: defina a propriedade storefront.tenant-id (ou a variável de ambiente STOREFRONT_TENANT_ID) com o ID de um tenant existente.\"}"
            );
            return;
        }

        try {
            TenantContext.setTenantId(storefrontTenantId);
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
