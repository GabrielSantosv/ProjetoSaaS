package com.portfolio.saas.tenant;

import com.portfolio.saas.auth.UserPrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filtro de Multi-tenancy que extrai o tenantId do usuário autenticado no JWT
 * e popula o TenantContext.
 * 
 * Regra Arquitetural:
 * - O tenantId NUNCA é lido da requisição HTTP (body ou query params).
 * - O TenantContext é OBRIGATORIAMENTE limpo no bloco finally para evitar vazamento entre threads.
 */
@Component
public class TenantFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

            if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal principal) {
                String tenantId = principal.getTenantId();
                if (tenantId != null && !tenantId.isBlank()) {
                    TenantContext.setTenantId(tenantId);
                }
            }

            filterChain.doFilter(request, response);
        } finally {
            // Garante que o contexto da thread seja limpo ao término de cada ciclo de requisição
            TenantContext.clear();
        }
    }
}
