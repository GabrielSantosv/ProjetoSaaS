package com.portfolio.saas.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private JwtService jwtService;
    private final String secretKey = "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";
    private final long expirationMs = 3600000; // 1 hour

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(secretKey, expirationMs);
    }

    @Test
    @DisplayName("Deve gerar token JWT com claims corretas e extraí-las com sucesso")
    void shouldGenerateAndExtractClaims() {
        User user = new User("João Silva", "joao@empresa.com", "hash", Role.ROLE_ADMIN);
        user.setId("usr-123");
        user.setTenantId("tenant-abc");

        String token = jwtService.generateToken(user);

        assertThat(token).isNotBlank();
        assertThat(jwtService.extractEmail(token)).isEqualTo("joao@empresa.com");
        assertThat(jwtService.extractTenantId(token)).isEqualTo("tenant-abc");
        assertThat(jwtService.extractUserId(token)).isEqualTo("usr-123");
        assertThat(jwtService.extractRole(token)).isEqualTo("ROLE_ADMIN");
        assertThat(jwtService.isTokenExpired(token)).isFalse();
    }

    @Test
    @DisplayName("Deve identificar token expirado")
    void shouldIdentifyExpiredToken() {
        JwtService shortLivedJwtService = new JwtService(secretKey, -1000); // Já expirado
        User user = new User("Maria", "maria@empresa.com", "hash", Role.ROLE_USER);
        user.setId("usr-456");
        user.setTenantId("tenant-xyz");

        String expiredToken = shortLivedJwtService.generateToken(user);

        assertThat(jwtService.isTokenExpired(expiredToken)).isTrue();
    }
}
