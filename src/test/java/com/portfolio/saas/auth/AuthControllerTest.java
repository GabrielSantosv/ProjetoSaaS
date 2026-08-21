package com.portfolio.saas.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.saas.auth.dto.LoginRequest;
import com.portfolio.saas.auth.dto.RegisterTenantRequest;
import com.portfolio.saas.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        jdbcTemplate.execute("DELETE FROM users");
        jdbcTemplate.execute("DELETE FROM tenants");
    }

    @Test
    @DisplayName("Deve registrar um novo tenant com administrador, fazer login e consultar /me com sucesso")
    void shouldRegisterTenantLoginAndGetProfile() throws Exception {
        // 1. Registro de Tenant
        RegisterTenantRequest registerRequest = new RegisterTenantRequest(
                "Supermercado Alpha",
                "11222333000199",
                "PRO",
                "Administrador Alpha",
                "admin@alpha.com",
                "senha123"
        );

        mockMvc.perform(post("/api/v1/auth/register-tenant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value("admin@alpha.com"))
                .andExpect(jsonPath("$.user.role").value("ROLE_ADMIN"))
                .andExpect(jsonPath("$.tenant.name").value("Supermercado Alpha"))
                .andExpect(jsonPath("$.tenant.document").value("11222333000199"));

        // 2. Login com credenciais válidas
        LoginRequest loginRequest = new LoginRequest("admin@alpha.com", "senha123");

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andReturn();

        String responseBody = loginResult.getResponse().getContentAsString();
        String token = objectMapper.readTree(responseBody).get("accessToken").asText();

        // 3. Consultar /api/v1/auth/me com o token gerado
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("admin@alpha.com"))
                .andExpect(jsonPath("$.name").value("Administrador Alpha"))
                .andExpect(jsonPath("$.role").value("ROLE_ADMIN"));
    }

    @Test
    @DisplayName("Deve rejeitar login com senha incorreta")
    void shouldRejectInvalidPassword() throws Exception {
        RegisterTenantRequest registerRequest = new RegisterTenantRequest(
                "Padaria Beta",
                "99888777000122",
                "BASIC",
                "Padaria Admin",
                "admin@beta.com",
                "senhaCorreta"
        );

        mockMvc.perform(post("/api/v1/auth/register-tenant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated());

        LoginRequest loginRequest = new LoginRequest("admin@beta.com", "senhaErrada");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("E-mail ou senha inválidos"));
    }

    @Test
    @DisplayName("Deve impedir registro de tenant duplicado com o mesmo documento")
    void shouldRejectDuplicateTenantDocument() throws Exception {
        RegisterTenantRequest registerRequest1 = new RegisterTenantRequest(
                "Loja Gamma 1",
                "33444555000100",
                "PRO",
                "Admin Gamma 1",
                "admin@gamma1.com",
                "senha123"
        );

        mockMvc.perform(post("/api/v1/auth/register-tenant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest1)))
                .andExpect(status().isCreated());

        RegisterTenantRequest registerRequest2 = new RegisterTenantRequest(
                "Loja Gamma 2",
                "33444555000100", // mesmo documento
                "PRO",
                "Admin Gamma 2",
                "admin@gamma2.com",
                "senha123"
        );

        mockMvc.perform(post("/api/v1/auth/register-tenant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest2)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Já existe uma empresa cadastrada com o documento informado: 33444555000100"));
    }

    @Test
    @DisplayName("Deve impedir registro de tenant com e-mail de administrador já existente")
    void shouldRejectDuplicateUserEmail() throws Exception {
        RegisterTenantRequest registerRequest1 = new RegisterTenantRequest(
                "Loja Delta 1",
                "77888999000111",
                "PRO",
                "Admin Delta",
                "admin@delta.com",
                "senha123"
        );

        mockMvc.perform(post("/api/v1/auth/register-tenant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest1)))
                .andExpect(status().isCreated());

        RegisterTenantRequest registerRequest2 = new RegisterTenantRequest(
                "Loja Delta 2",
                "55666777000122", // documento diferente
                "PRO",
                "Outro Admin",
                "admin@delta.com", // mesmo e-mail
                "senha123"
        );

        mockMvc.perform(post("/api/v1/auth/register-tenant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest2)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Já existe um usuário cadastrado com o e-mail informado: admin@delta.com"));
    }
}
