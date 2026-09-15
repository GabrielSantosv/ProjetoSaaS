package com.portfolio.saas.pdv;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.saas.auth.Role;
import com.portfolio.saas.auth.User;
import com.portfolio.saas.auth.UserRepository;
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
import org.springframework.security.crypto.password.PasswordEncoder;
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

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

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
    @DisplayName("Deve permitir reabrir uma mesa com o mesmo número após ela ter sido fechada, sem herdar itens da comanda anterior")
    void shouldAllowReopeningTableWithSameNumberAfterItWasClosed() throws Exception {
        String token = registerAndGetToken("Giro de Mesas", "77777777000177", "admin@girodemesas.com");

        MvcResult categoryResult = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CategoryRequest("Categoria Giro", "teste"))))
                .andExpect(status().isCreated())
                .andReturn();
        String categoryId = objectMapper.readTree(categoryResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult productResult = mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProductRequest(
                                "GIRO-01", "Produto Giro", new BigDecimal("15.00"), 10, categoryId))))
                .andExpect(status().isCreated())
                .andReturn();
        String productId = objectMapper.readTree(productResult.getResponse().getContentAsString()).get("id").asText();

        // Primeiro ciclo: abre a mesa 3, lança item, fecha a conta.
        MvcResult firstOpen = mockMvc.perform(post("/api/v1/pdv/tables")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("tableNumber", "Mesa 3", "customerName", "Primeiro Cliente"))))
                .andExpect(status().isCreated())
                .andReturn();
        String firstTableId = objectMapper.readTree(firstOpen.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/pdv/tables/" + firstTableId + "/items")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("productId", productId, "quantity", 3))))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/pdv/tables/" + firstTableId + "/close")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // Segundo ciclo: mesmo número de mesa, giro normal de restaurante — não pode falhar
        // dizendo "já existe uma mesa aberta" nem herdar os itens da comanda anterior.
        MvcResult secondOpen = mockMvc.perform(post("/api/v1/pdv/tables")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("tableNumber", "Mesa 3", "customerName", "Segundo Cliente"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.customerName").value("Segundo Cliente"))
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.orderId").doesNotExist())
                .andReturn();
        String secondTableId = objectMapper.readTree(secondOpen.getResponse().getContentAsString()).get("id").asText();

        assertThat(secondTableId).isEqualTo(firstTableId);

        Integer tableRowCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM restaurant_tables WHERE tenant_id = (SELECT tenant_id FROM users WHERE email = ?) AND number = 3",
                Integer.class,
                "admin@girodemesas.com"
        );
        assertThat(tableRowCount).isEqualTo(1);
    }

    @Test
    @DisplayName("Deve aplicar dois addItem concorrentes do mesmo produto na mesma mesa sem perder clique nem duplicar linha")
    void shouldApplyConcurrentAddItemOfSameProductWithoutLosingClicksOrDuplicatingRow() throws Exception {
        Tenant tenant = tenantRepository.save(new Tenant(null, "Tenant Concorrência Item", "88888888000188", "PRO", true));
        TenantContext.setTenantId(tenant.getId());

        Product product = productRepository.save(new Product(
                "PDV-CONC-ITEM-01",
                "Produto Item Concorrente",
                new BigDecimal("10.00"),
                50,
                null
        ));

        PdvTableSessionResponse opened = pdvTableService.openTable(new OpenTableRequest("Mesa 21", "Diagnostico"));
        String tableId = opened.id();

        int threads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Object>> futures = new ArrayList<>();

        for (int i = 0; i < threads; i++) {
            futures.add(executor.submit(() -> {
                TenantContext.setTenantId(tenant.getId());
                try {
                    ready.countDown();
                    start.await();
                    return pdvTableService.addItem(tableId, new AddTableItemRequest(product.getId(), 1));
                } catch (Exception ex) {
                    return ex;
                } finally {
                    TenantContext.clear();
                }
            }));
        }

        ready.await();
        start.countDown();

        int successes = 0;
        List<Exception> failures = new ArrayList<>();
        for (Future<Object> future : futures) {
            Object result = future.get();
            if (result instanceof Exception ex) {
                failures.add(ex);
            } else {
                successes++;
            }
        }
        executor.shutdown();

        assertThat(failures).isEmpty();
        assertThat(successes).isEqualTo(2);

        Integer rowCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM restaurant_table_items WHERE restaurant_table_id = ? AND product_id = ?",
                Integer.class,
                tableId,
                product.getId()
        );
        assertThat(rowCount).isEqualTo(1);

        Integer finalQuantity = jdbcTemplate.queryForObject(
                "SELECT quantity FROM restaurant_table_items WHERE restaurant_table_id = ? AND product_id = ?",
                Integer.class,
                tableId,
                product.getId()
        );
        assertThat(finalQuantity).isEqualTo(2);
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

    @Test
    @DisplayName("Deve permitir ADMIN/SELLER/USER nas ações do PDV e bloquear CASHIER com 403 nas quatro rotas")
    void shouldEnforceRoleBasedAccessOnAllPdvEndpoints() throws Exception {
        String adminToken = registerAndGetToken("RBAC Restaurante", "22222222000122", "admin@rbacrestaurante.com");

        String tenantId = jdbcTemplate.queryForObject(
                "SELECT tenant_id FROM users WHERE email = ?",
                String.class,
                "admin@rbacrestaurante.com"
        );

        TenantContext.setTenantId(tenantId);
        try {
            userRepository.save(new User("Garcom PDV", "garcom@rbacrestaurante.com",
                    passwordEncoder.encode("senha123"), Role.ROLE_USER));
            userRepository.save(new User("Operador Caixa", "caixa@rbacrestaurante.com",
                    passwordEncoder.encode("senha123"), Role.ROLE_CASHIER));
        } finally {
            TenantContext.clear();
        }

        String userToken = loginAndGetToken("garcom@rbacrestaurante.com", "senha123");
        String cashierToken = loginAndGetToken("caixa@rbacrestaurante.com", "senha123");

        MvcResult categoryResult = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CategoryRequest("Bebidas RBAC", "Categoria de teste"))))
                .andExpect(status().isCreated())
                .andReturn();
        String categoryId = objectMapper.readTree(categoryResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult productResult = mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProductRequest(
                                "RBAC-01", "Água mineral", new BigDecimal("6.00"), 10, categoryId))))
                .andExpect(status().isCreated())
                .andReturn();
        String productId = objectMapper.readTree(productResult.getResponse().getContentAsString()).get("id").asText();

        // GET /tables: CASHIER bloqueado, USER permitido
        mockMvc.perform(get("/api/v1/pdv/tables").header("Authorization", "Bearer " + cashierToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/pdv/tables").header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk());

        // POST /tables (abrir mesa): CASHIER bloqueado, USER permitido
        mockMvc.perform(post("/api/v1/pdv/tables")
                        .header("Authorization", "Bearer " + cashierToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("tableNumber", "Mesa 20", "customerName", "Cliente RBAC"))))
                .andExpect(status().isForbidden());

        MvcResult openResult = mockMvc.perform(post("/api/v1/pdv/tables")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("tableNumber", "Mesa 20", "customerName", "Cliente RBAC"))))
                .andExpect(status().isCreated())
                .andReturn();
        String tableId = objectMapper.readTree(openResult.getResponse().getContentAsString()).get("id").asText();

        // POST /tables/{id}/items: CASHIER bloqueado, USER permitido
        mockMvc.perform(post("/api/v1/pdv/tables/" + tableId + "/items")
                        .header("Authorization", "Bearer " + cashierToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("productId", productId, "quantity", 1))))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/pdv/tables/" + tableId + "/items")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("productId", productId, "quantity", 1))))
                .andExpect(status().isCreated());

        // POST /tables/{id}/close: CASHIER bloqueado (mesa continua aberta), USER permitido
        mockMvc.perform(post("/api/v1/pdv/tables/" + tableId + "/close")
                        .header("Authorization", "Bearer " + cashierToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/pdv/tables/" + tableId + "/close")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));
    }

    private String loginAndGetToken(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }
}
