package com.portfolio.saas.pdv;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.saas.auth.dto.RegisterTenantRequest;
import com.portfolio.saas.catalog.dto.CategoryRequest;
import com.portfolio.saas.catalog.dto.ProductRequest;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PdvSaleIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        jdbcTemplate.execute("DELETE FROM order_items");
        jdbcTemplate.execute("DELETE FROM orders");
        jdbcTemplate.execute("DELETE FROM products");
        jdbcTemplate.execute("DELETE FROM categories");
        jdbcTemplate.execute("DELETE FROM users");
        jdbcTemplate.execute("DELETE FROM tenants");
    }

    private String registerAndGetToken(String companyName, String document, String email) throws Exception {
        RegisterTenantRequest request = new RegisterTenantRequest(
                companyName,
                document,
                "PRO",
                "Admin " + companyName,
                email,
                "senha123"
        );

        MvcResult result = mockMvc.perform(post("/api/v1/auth/register-tenant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }

    @Test
    @DisplayName("Deve registrar uma venda direta no PDV e debitar estoque")
    void shouldCreateDirectSaleAtPdvAndDecreaseStock() throws Exception {
        String token = registerAndGetToken("Padaria Central", "11111111000101", "admin@padaria.com");

        MvcResult categoryResult = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CategoryRequest("Bebidas", "Refrigerantes e água"))))
                .andExpect(status().isCreated())
                .andReturn();

        String categoryId = objectMapper.readTree(categoryResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult productResult = mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProductRequest(
                                "REFRIG-01",
                                "Refrigerante 600ml",
                                new BigDecimal("8.50"),
                                5,
                                categoryId))))
                .andExpect(status().isCreated())
                .andReturn();

        String productId = objectMapper.readTree(productResult.getResponse().getContentAsString()).get("id").asText();

        var payload = Map.of(
                "customerId", "cashier-01",
                "channel", "PDV",
                "items", List.of(Map.of(
                        "productId", productId,
                        "quantity", 2
                ))
        );

        mockMvc.perform(post("/api/v1/pdv/sales")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.customerId").value("cashier-01"))
                .andExpect(jsonPath("$.channel").value("PDV"))
                .andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.total").value(17.0));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/products/" + productId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stockQuantity").value(3));
    }

    @Test
    @DisplayName("Deve bloquear venda direta no PDV quando o estoque for insuficiente")
    void shouldRejectPdvSaleWhenStockIsInsufficient() throws Exception {
        String token = registerAndGetToken("Mercado Nova", "22222222000102", "admin@mercado.com");

        MvcResult categoryResult = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CategoryRequest("Higiene", "Produtos de limpeza"))))
                .andExpect(status().isCreated())
                .andReturn();

        String categoryId = objectMapper.readTree(categoryResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult productResult = mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProductRequest(
                                "LIMP-01",
                                "Detergente",
                                new BigDecimal("12.00"),
                                1,
                                categoryId))))
                .andExpect(status().isCreated())
                .andReturn();

        String productId = objectMapper.readTree(productResult.getResponse().getContentAsString()).get("id").asText();

        var payload = Map.of(
                "customerId", "cashier-02",
                "channel", "PDV",
                "items", List.of(Map.of(
                        "productId", productId,
                        "quantity", 3
                ))
        );

        mockMvc.perform(post("/api/v1/pdv/sales")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Estoque insuficiente")));
    }
}
