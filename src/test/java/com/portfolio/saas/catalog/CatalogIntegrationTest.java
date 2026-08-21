package com.portfolio.saas.catalog;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.saas.auth.dto.RegisterTenantRequest;
import com.portfolio.saas.catalog.dto.CategoryRequest;
import com.portfolio.saas.catalog.dto.ProductRequest;
import com.portfolio.saas.catalog.dto.StockAdjustmentRequest;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CatalogIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
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
    @DisplayName("Deve gerenciar categorias e produtos respeitando isolamento total entre Tenant A e Tenant B")
    void shouldManageCatalogWithStrictTenantIsolation() throws Exception {
        // 1. Obter tokens JWT para Tenant A e Tenant B
        String tokenA = registerAndGetToken("Loja Alpha", "11111111000101", "admin@alpha-store.com");
        String tokenB = registerAndGetToken("Loja Beta", "22222222000102", "admin@beta-store.com");

        // 2. Tenant A cria Categoria e Produto
        CategoryRequest catReqA = new CategoryRequest("Informática", "Computadores e periféricos");
        MvcResult catResultA = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(catReqA)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Informática"))
                .andReturn();

        String catIdA = objectMapper.readTree(catResultA.getResponse().getContentAsString()).get("id").asText();

        ProductRequest prodReqA = new ProductRequest(
                "NOTE-DELL-G15",
                "Notebook Dell G15",
                new BigDecimal("5499.90"),
                10,
                catIdA
        );

        MvcResult prodResultA = mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(prodReqA)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sku").value("NOTE-DELL-G15"))
                .andExpect(jsonPath("$.stockQuantity").value(10))
                .andExpect(jsonPath("$.categoryName").value("Informática"))
                .andReturn();

        String prodIdA = objectMapper.readTree(prodResultA.getResponse().getContentAsString()).get("id").asText();

        // 3. Tenant B tenta acessar os dados do Tenant A e deve receber 404
        mockMvc.perform(get("/api/v1/categories/" + catIdA)
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/products/" + prodIdA)
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isNotFound());

        // 4. Tenant B pode criar uma Categoria com mesmo nome e Produto com MESMO SKU no seu próprio tenant
        CategoryRequest catReqB = new CategoryRequest("Informática", "Linha corporativa");
        mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + tokenB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(catReqB)))
                .andExpect(status().isCreated());

        ProductRequest prodReqB = new ProductRequest(
                "NOTE-DELL-G15", // Mesmo SKU, mas no Tenant B
                "Notebook Dell G15 Empresa B",
                new BigDecimal("5200.00"),
                5,
                null
        );

        mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + tokenB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(prodReqB)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sku").value("NOTE-DELL-G15"))
                .andExpect(jsonPath("$.name").value("Notebook Dell G15 Empresa B"));

        // 5. Tenant A ajusta o estoque (+5 unidades)
        StockAdjustmentRequest addStock = new StockAdjustmentRequest(5);
        mockMvc.perform(patch("/api/v1/products/" + prodIdA + "/stock")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addStock)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stockQuantity").value(15));

        // 6. Tenant A tenta subtrair mais estoque do que o disponível (deve retornar 400)
        StockAdjustmentRequest subStockExceeded = new StockAdjustmentRequest(-30);
        mockMvc.perform(patch("/api/v1/products/" + prodIdA + "/stock")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(subStockExceeded)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Estoque insuficiente")));

        // 7. Tenant A tenta excluir a categoria com produto vinculado (deve ser bloqueado com 400)
        mockMvc.perform(delete("/api/v1/categories/" + catIdA)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Não é possível excluir uma categoria que possui produtos vinculados")));

        // 8. Tenant A exclui o produto e depois exclui a categoria com sucesso
        mockMvc.perform(delete("/api/v1/products/" + prodIdA)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isNoContent());

        mockMvc.perform(delete("/api/v1/categories/" + catIdA)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isNoContent());
    }
}
