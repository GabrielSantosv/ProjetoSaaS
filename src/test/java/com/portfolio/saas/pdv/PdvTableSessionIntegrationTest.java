package com.portfolio.saas.pdv;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.saas.auth.dto.RegisterTenantRequest;
import com.portfolio.saas.catalog.Product;
import com.portfolio.saas.catalog.ProductRepository;
import com.portfolio.saas.catalog.dto.CategoryRequest;
import com.portfolio.saas.catalog.dto.ProductRequest;
import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.pdv.dto.AddTableItemRequest;
import com.portfolio.saas.pdv.dto.OpenTableRequest;
import com.portfolio.saas.pdv.dto.PdvTableSessionResponse;
import com.portfolio.saas.tenant.Tenant;
import com.portfolio.saas.tenant.TenantContext;
import com.portfolio.saas.tenant.TenantRepository;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PdvTableSessionIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PdvTableService pdvTableService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        jdbcTemplate.execute("DELETE FROM restaurant_table_items");
        jdbcTemplate.execute("DELETE FROM restaurant_tables");
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
    @DisplayName("Deve abrir uma comanda, adicionar item e fechar com baixa de estoque")
    void shouldOpenTableSessionAddItemAndCloseIt() throws Exception {
        String token = registerAndGetToken("Cafe Central", "33333333000103", "admin@cafecentral.com");

        MvcResult categoryResult = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CategoryRequest("Cafés", "Bebidas quentes"))))
                .andExpect(status().isCreated())
                .andReturn();

        String categoryId = objectMapper.readTree(categoryResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult productResult = mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProductRequest(
                                "CAFE-01",
                                "Café Expresso",
                                new BigDecimal("18.00"),
                                5,
                                categoryId))))
                .andExpect(status().isCreated())
                .andReturn();

        String productId = objectMapper.readTree(productResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult openSessionResult = mockMvc.perform(post("/api/v1/pdv/tables")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "tableNumber", "Mesa 5",
                                "customerName", "João"
                        ))))
                .andExpect(status().isCreated())
                .andReturn();

        String tableId = objectMapper.readTree(openSessionResult.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/pdv/tables/" + tableId + "/items")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "productId", productId,
                                "quantity", 2
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.total").value(36.0));

        mockMvc.perform(post("/api/v1/pdv/tables/" + tableId + "/close")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"))
                .andExpect(jsonPath("$.orderId").exists());

        mockMvc.perform(get("/api/v1/products/" + productId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stockQuantity").value(3));
    }

    @Test
    @DisplayName("Deve persistir a comanda em banco para que o estado da mesa sobreviva ao ciclo da requisição")
    void shouldPersistTableSessionInDatabase() throws Exception {
        String token = registerAndGetToken("Boteco do Bairro", "55555555000155", "admin@botecodobairro.com");

        MvcResult categoryResult = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CategoryRequest("Bebidas", "Refrigerantes e chopp"))))
                .andExpect(status().isCreated())
                .andReturn();

        String categoryId = objectMapper.readTree(categoryResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult productResult = mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProductRequest(
                                "REF-01",
                                "Refrigerante",
                                new BigDecimal("10.00"),
                                4,
                                categoryId))))
                .andExpect(status().isCreated())
                .andReturn();

        String productId = objectMapper.readTree(productResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult openSessionResult = mockMvc.perform(post("/api/v1/pdv/tables")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "tableNumber", "Mesa 8",
                                "customerName", "Carlos"
                        ))))
                .andExpect(status().isCreated())
                .andReturn();

        String tableId = objectMapper.readTree(openSessionResult.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/pdv/tables/" + tableId + "/items")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "productId", productId,
                                "quantity", 2
                        ))))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/pdv/tables/" + tableId + "/close")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        Integer persistedRows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM restaurant_tables WHERE id = ?",
                Integer.class,
                tableId
        );

        org.assertj.core.api.Assertions.assertThat(persistedRows).isEqualTo(1);
    }

    @Test
    @DisplayName("Deve impedir fechamento concorrente da mesma mesa e manter o estoque debitado uma única vez")
    void shouldRejectConcurrentCloseOfSameTableAndDeductStockOnlyOnce() throws Exception {
        Tenant tenant = tenantRepository.save(new Tenant(null, "Tenant Concorrência", "99999999000190", "PRO", true));
        TenantContext.setTenantId(tenant.getId());

        Product product = productRepository.save(new Product(
                "PDV-CONC-01",
                "Produto Conflitante",
                new BigDecimal("25.00"),
                5,
                null
        ));

        PdvTableSessionResponse opened = pdvTableService.openTable(new OpenTableRequest("Mesa 9", "Paulo"));
        pdvTableService.addItem(opened.id(), new AddTableItemRequest(product.getId(), 2));

        String tableId = opened.id();
        int threads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> futures = new ArrayList<>();

        for (int i = 0; i < threads; i++) {
            futures.add(executor.submit(() -> {
                TenantContext.setTenantId(tenant.getId());
                try {
                    ready.countDown();
                    start.await();
                    pdvTableService.closeTable(tableId);
                    return true;
                } catch (BusinessException ex) {
                    assertThat(ex.getMessage()).contains("outro terminal");
                    return false;
                } finally {
                    TenantContext.clear();
                }
            }));
        }

        ready.await();
        start.countDown();

        int successes = 0;
        int failures = 0;
        for (Future<Boolean> future : futures) {
            if (future.get()) {
                successes++;
            } else {
                failures++;
            }
        }

        executor.shutdown();

        assertThat(successes).isEqualTo(1);
        assertThat(failures).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM orders", Integer.class)).isEqualTo(1);
        assertThat(productRepository.findByIdScoped(product.getId()).orElseThrow().getStockQuantity()).isEqualTo(3);
    }

    @Test
    @DisplayName("Deve bloquear adição de item a comanda quando o estoque for insuficiente")
    void shouldRejectTableItemWhenStockIsInsufficient() throws Exception {
        String token = registerAndGetToken("Lanchonete Brasil", "44444444000104", "admin@lanchonete.com");

        MvcResult categoryResult = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CategoryRequest("Sobremesas", "Doces e bolos"))))
                .andExpect(status().isCreated())
                .andReturn();

        String categoryId = objectMapper.readTree(categoryResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult productResult = mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProductRequest(
                                "DOCE-01",
                                "Chocolate",
                                new BigDecimal("12.50"),
                                1,
                                categoryId))))
                .andExpect(status().isCreated())
                .andReturn();

        String productId = objectMapper.readTree(productResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult openSessionResult = mockMvc.perform(post("/api/v1/pdv/tables")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "tableNumber", "Mesa 2",
                                "customerName", "Maria"
                        ))))
                .andExpect(status().isCreated())
                .andReturn();

        String tableId = objectMapper.readTree(openSessionResult.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/pdv/tables/" + tableId + "/items")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "productId", productId,
                                "quantity", 2
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Estoque insuficiente")));
    }
}
