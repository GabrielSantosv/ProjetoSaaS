package com.portfolio.saas.auth;

import com.portfolio.saas.auth.dto.AuthResponse;
import com.portfolio.saas.auth.dto.LoginRequest;
import com.portfolio.saas.auth.dto.RegisterTenantRequest;
import com.portfolio.saas.auth.dto.TenantResponse;
import com.portfolio.saas.auth.dto.UserResponse;
import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.common.exception.UnauthorizedException;
import com.portfolio.saas.tenant.Tenant;
import com.portfolio.saas.tenant.TenantContext;
import com.portfolio.saas.tenant.TenantRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;

@Service
public class AuthService {

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TransactionTemplate transactionTemplate;
    private final long jwtExpirationMs;

    public AuthService(
            TenantRepository tenantRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            PlatformTransactionManager transactionManager,
            @Value("${security.jwt.expiration-ms:86400000}") long jwtExpirationMs
    ) {
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.jwtExpirationMs = jwtExpirationMs;
    }

    public AuthResponse registerTenant(RegisterTenantRequest request) {
        if (tenantRepository.existsByDocument(request.document())) {
            throw new BusinessException("Já existe uma empresa cadastrada com o documento informado: " + request.document());
        }

        if (userRepository.existsByEmailGlobal(request.adminEmail())) {
            throw new BusinessException("Já existe um usuário cadastrado com o e-mail informado: " + request.adminEmail());
        }

        String tenantId = UUID.randomUUID().toString();
        TenantContext.setTenantId(tenantId);

        try {
            return transactionTemplate.execute(status -> {
                // 1. Cria a entidade raiz Tenant
                Tenant tenant = new Tenant();
                tenant.setId(tenantId);
                tenant.setName(request.companyName());
                tenant.setDocument(request.document());
                tenant.setPlanId(request.planId());
                tenant.setActive(true);
                tenant = tenantRepository.save(tenant);

                // 2. Cria o primeiro usuário administrador vinculado ao tenant
                User admin = new User(
                        request.adminName(),
                        request.adminEmail(),
                        passwordEncoder.encode(request.adminPassword()),
                        Role.ROLE_ADMIN
                );
                admin.setTenantId(tenantId);
                admin = userRepository.save(admin);

                String token = jwtService.generateToken(admin);

                return new AuthResponse(
                        token,
                        jwtExpirationMs / 1000,
                        UserResponse.fromUser(admin),
                        TenantResponse.fromTenant(tenant)
                );
            });
        } finally {
            TenantContext.clear();
        }
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmailForLogin(request.email())
                .orElseThrow(() -> new UnauthorizedException("E-mail ou senha inválidos"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("E-mail ou senha inválidos");
        }

        Tenant tenant = tenantRepository.findById(user.getTenantId())
                .orElseThrow(() -> new UnauthorizedException("Empresa vinculada não encontrada"));

        if (!tenant.isActive()) {
            throw new UnauthorizedException("Esta empresa está inativa. Entre em contato com o suporte.");
        }

        String token = jwtService.generateToken(user);

        return new AuthResponse(
                token,
                jwtExpirationMs / 1000,
                UserResponse.fromUser(user),
                TenantResponse.fromTenant(tenant)
        );
    }
}
