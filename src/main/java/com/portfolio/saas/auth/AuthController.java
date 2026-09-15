package com.portfolio.saas.auth;

import com.portfolio.saas.auth.dto.AuthResponse;
import com.portfolio.saas.auth.dto.ChangePasswordRequest;
import com.portfolio.saas.auth.dto.LoginRequest;
import com.portfolio.saas.auth.dto.RegisterTenantRequest;
import com.portfolio.saas.auth.dto.UserResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Autenticação & Tenant", description = "Endpoints para registro de empresas, login e perfil de usuário")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register-tenant")
    @Operation(summary = "Registrar novo Tenant e Administrador", description = "Cria uma nova empresa e o usuário administrador inicial")
    public ResponseEntity<AuthResponse> registerTenant(@Valid @RequestBody RegisterTenantRequest request) {
        AuthResponse response = authService.registerTenant(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    @Operation(summary = "Realizar Login", description = "Autentica o usuário e retorna o token JWT com claims de tenantId e permissões")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    @Operation(summary = "Dados do Usuário Autenticado", description = "Retorna os dados do usuário autenticado no token JWT atual", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<UserResponse> getCurrentUser(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(UserResponse.fromPrincipal(principal));
    }

    @PostMapping("/change-password")
    @Operation(summary = "Trocar a própria senha", description = "Troca a senha do usuário autenticado. Tokens já emitidos continuam válidos até expirar (JWT stateless).", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        authService.changePassword(principal.getId(), request);
        return ResponseEntity.noContent().build();
    }
}
