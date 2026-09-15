package com.portfolio.saas.cashier;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.saas.auth.Role;
import com.portfolio.saas.auth.User;
import com.portfolio.saas.auth.UserRepository;
import com.portfolio.saas.auth.dto.RegisterTenantRequest;
import com.portfolio.saas.catalog.dto.CategoryRequest;
import com.portfolio.saas.catalog.dto.ProductRequest;
import com.portfolio.saas.order.dto.CreateOrderRequest;
import com.portfolio.saas.order.dto.OrderItemRequest;
import com.portfolio.saas.tenant.TenantContext;
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
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CashierFlowIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @AfterEach
    void tearDown() {
        jdbcTemplate.execute("DELETE FROM payments");
        jdbcTemplate.execute("DELETE FROM cash_registers");
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
    @DisplayName("Deve abrir caixa, registrar pagamento e fechar o caixa usando os pagamentos reais")
    void shouldOpenCashRegisterRecordPaymentAndCloseIt() throws Exception {
        String token = registerAndGetToken("Padaria Nova", "77777777000188", "admin@padarianova.com");

        MvcResult categoryResult = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CategoryRequest("Padaria", "Produtos de padaria"))))
                .andExpect(status().isCreated())
                .andReturn();

        String categoryId = objectMapper.readTree(categoryResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult productResult = mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProductRequest(
                                "PÃO-01",
                                "Pão de Queijo",
                                new BigDecimal("12.50"),
                                10,
                                categoryId))))
                .andExpect(status().isCreated())
                .andReturn();

        String productId = objectMapper.readTree(productResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult orderResult = mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateOrderRequest(
                                "cliente-001",
                                com.portfolio.saas.order.OrderChannel.ECOMMERCE,
                                java.util.List.of(new OrderItemRequest(productId, 2))))))
                .andExpect(status().isCreated())
                .andReturn();

        String orderId = objectMapper.readTree(orderResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult openCashResult = mockMvc.perform(post("/api/v1/cashier/registers/open")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andReturn();

        String cashRegisterId = objectMapper.readTree(openCashResult.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/payments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "orderId", orderId,
                                "method", "CASH",
                                "amount", "25.00"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.method").value("CASH"))
                .andExpect(jsonPath("$.status").value("PAID"));

        mockMvc.perform(post("/api/v1/cashier/registers/" + cashRegisterId + "/close")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "cashAmount", "25.00",
                                "cardAmount", "0.00"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"))
                .andExpect(jsonPath("$.totalCash").value(25.00))
                .andExpect(jsonPath("$.cashDifference").value(0.00));

        mockMvc.perform(get("/api/v1/payments")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].method").value("CASH"));

        String orderStatus = jdbcTemplate.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, orderId);
        org.assertj.core.api.Assertions.assertThat(orderStatus).isEqualTo("COMPLETED");
    }

    @Test
    @DisplayName("Deve rejeitar abertura de caixa quando já existe caixa aberto")
    void shouldRejectOpeningCashRegisterWhenAlreadyOpen() throws Exception {
        String token = registerAndGetToken("Mercado Central", "88888888000199", "admin@mercadocentral.com");

        mockMvc.perform(post("/api/v1/cashier/registers/open")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/cashier/registers/open")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("já existe")));
    }

    @Test
    @DisplayName("Deve impedir duas aberturas concorrentes para o mesmo tenant")
    void shouldRejectConcurrentOpenCashRegisterForSameTenant() throws Exception {
        String token = registerAndGetToken("Lanchonete do Bairro", "99999999000100", "admin@lanchonetadobairro.com");
        String tenantId = jdbcTemplate.queryForObject("SELECT id FROM tenants WHERE document = ?", String.class, "99999999000100");

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch ready = new CountDownLatch(2);

        Future<Integer> first = executor.submit(() -> {
            ready.countDown();
            start.await();
            MvcResult result = mockMvc.perform(post("/api/v1/cashier/registers/open")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andReturn();
            return result.getResponse().getStatus();
        });

        Future<Integer> second = executor.submit(() -> {
            ready.countDown();
            start.await();
            MvcResult result = mockMvc.perform(post("/api/v1/cashier/registers/open")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andReturn();
            return result.getResponse().getStatus();
        });

        ready.await();
        start.countDown();

        int firstStatus = first.get();
        int secondStatus = second.get();
        executor.shutdown();

        org.assertj.core.api.Assertions.assertThat(firstStatus + secondStatus).isEqualTo(201 + 400);
        Integer openRegisters = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM cash_registers WHERE tenant_id = ? AND status = 'OPEN'",
                Integer.class,
                tenantId
        );
        org.assertj.core.api.Assertions.assertThat(openRegisters).isEqualTo(1);
    }

    @Test
    @DisplayName("Deve rejeitar pagamento duplicado ou excedente para o mesmo pedido")
    void shouldRejectDuplicateOrOverpaidOrderPayment() throws Exception {
        String token = registerAndGetToken("Mercado do Bairro", "10101010000155", "admin@mercadodobairro.com");

        MvcResult categoryResult = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CategoryRequest("Bebidas", "Bebidas"))))
                .andExpect(status().isCreated())
                .andReturn();

        String categoryId = objectMapper.readTree(categoryResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult productResult = mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProductRequest(
                                "REF-010",
                                "Refrigerante",
                                new BigDecimal("10.00"),
                                5,
                                categoryId))))
                .andExpect(status().isCreated())
                .andReturn();

        String productId = objectMapper.readTree(productResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult orderResult = mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateOrderRequest(
                                "cliente-777",
                                com.portfolio.saas.order.OrderChannel.ECOMMERCE,
                                java.util.List.of(new OrderItemRequest(productId, 1))))))
                .andExpect(status().isCreated())
                .andReturn();

        String orderId = objectMapper.readTree(orderResult.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/payments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "orderId", orderId,
                                "method", "CARD",
                                "amount", "10.00"
                        ))))
                .andExpect(status().isCreated());

        String orderStatus = jdbcTemplate.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, orderId);
        org.assertj.core.api.Assertions.assertThat(orderStatus).isEqualTo("COMPLETED");

        mockMvc.perform(post("/api/v1/payments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "orderId", orderId,
                                "method", "CASH",
                                "amount", "1.00"
                        ))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Deve rejeitar dois pagamentos parciais concorrentes acima do total do pedido")
    void shouldRejectConcurrentPartialPaymentForSameOrder() throws Exception {
        String token = registerAndGetToken("Padaria Central", "11111111000177", "admin@paderiacentral.com");

        MvcResult categoryResult = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CategoryRequest("Doces", "Doces"))))
                .andExpect(status().isCreated())
                .andReturn();

        String categoryId = objectMapper.readTree(categoryResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult productResult = mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProductRequest(
                                "DOC-001",
                                "Bolo",
                                new BigDecimal("50.00"),
                                10,
                                categoryId))))
                .andExpect(status().isCreated())
                .andReturn();

        String productId = objectMapper.readTree(productResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult orderResult = mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateOrderRequest(
                                "cliente-200",
                                com.portfolio.saas.order.OrderChannel.ECOMMERCE,
                                java.util.List.of(new OrderItemRequest(productId, 1))))))
                .andExpect(status().isCreated())
                .andReturn();

        String orderId = objectMapper.readTree(orderResult.getResponse().getContentAsString()).get("id").asText();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        Future<Integer> first = executor.submit(() -> {
            ready.countDown();
            start.await();
            MvcResult result = mockMvc.perform(post("/api/v1/payments")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "orderId", orderId,
                                    "method", "CASH",
                                    "amount", "30.00"
                            ))))
                    .andReturn();
            return result.getResponse().getStatus();
        });

        Future<Integer> second = executor.submit(() -> {
            ready.countDown();
            start.await();
            MvcResult result = mockMvc.perform(post("/api/v1/payments")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "orderId", orderId,
                                    "method", "CARD",
                                    "amount", "30.00"
                            ))))
                    .andReturn();
            return result.getResponse().getStatus();
        });

        ready.await();
        start.countDown();

        int firstStatus = first.get();
        int secondStatus = second.get();
        executor.shutdown();

        org.assertj.core.api.Assertions.assertThat(firstStatus + secondStatus).isEqualTo(201 + 400);
        BigDecimal totalPaid = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = ?", BigDecimal.class, orderId);
        org.assertj.core.api.Assertions.assertThat(totalPaid).isEqualByComparingTo("30.00");
    }

    @Test
    @DisplayName("Deve bloquear SELLER e USER com 403 nas rotas de caixa e permitir ADMIN/CASHIER")
    void shouldEnforceRoleBasedAccessOnCashierEndpoints() throws Exception {
        String adminToken = registerAndGetToken("RBAC Caixa", "33333333000144", "admin@rbaccaixa.com");

        String tenantId = jdbcTemplate.queryForObject(
                "SELECT tenant_id FROM users WHERE email = ?", String.class, "admin@rbaccaixa.com");

        TenantContext.setTenantId(tenantId);
        try {
            userRepository.save(new User("Vendedor RBAC", "vendedor@rbaccaixa.com",
                    passwordEncoder.encode("senha123"), Role.ROLE_SELLER));
            userRepository.save(new User("Usuario RBAC", "usuario@rbaccaixa.com",
                    passwordEncoder.encode("senha123"), Role.ROLE_USER));
            userRepository.save(new User("Operador Caixa RBAC", "caixa@rbaccaixa.com",
                    passwordEncoder.encode("senha123"), Role.ROLE_CASHIER));
        } finally {
            TenantContext.clear();
        }

        String sellerToken = loginAndGetToken("vendedor@rbaccaixa.com", "senha123");
        String userToken = loginAndGetToken("usuario@rbaccaixa.com", "senha123");
        String cashierToken = loginAndGetToken("caixa@rbaccaixa.com", "senha123");

        // ADMIN permitido no histórico (rota nunca usada como CASHIER neste teste)
        mockMvc.perform(get("/api/v1/cashier/registers")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // SELLER e USER bloqueados em todas as rotas de caixa
        mockMvc.perform(post("/api/v1/cashier/registers/open")
                        .header("Authorization", "Bearer " + sellerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/cashier/registers/open")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/cashier/registers/open")
                        .header("Authorization", "Bearer " + sellerToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/cashier/registers")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());

        // CASHIER (não-ADMIN) consegue abrir, consultar e listar histórico normalmente
        MvcResult openResult = mockMvc.perform(post("/api/v1/cashier/registers/open")
                        .header("Authorization", "Bearer " + cashierToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andReturn();
        String cashRegisterId = objectMapper.readTree(openResult.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(get("/api/v1/cashier/registers")
                        .header("Authorization", "Bearer " + cashierToken))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/cashier/registers/" + cashRegisterId + "/close")
                        .header("Authorization", "Bearer " + sellerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("cashAmount", "0.00", "cardAmount", "0.00"))))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/cashier/registers/" + cashRegisterId + "/close")
                        .header("Authorization", "Bearer " + cashierToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("cashAmount", "0.00", "cardAmount", "0.00"))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Deve rejeitar o segundo de dois fechamentos concorrentes do mesmo caixa com mensagem clara")
    void shouldRejectConcurrentCloseOfSameCashRegister() throws Exception {
        String token = registerAndGetToken("Concorrencia Caixa", "44444444000155", "admin@concorrenciacaixa.com");

        MvcResult openResult = mockMvc.perform(post("/api/v1/cashier/registers/open")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andReturn();
        String cashRegisterId = objectMapper.readTree(openResult.getResponse().getContentAsString()).get("id").asText();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        Future<MvcResult> first = executor.submit(() -> {
            ready.countDown();
            start.await();
            return mockMvc.perform(post("/api/v1/cashier/registers/" + cashRegisterId + "/close")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("cashAmount", "0.00", "cardAmount", "0.00"))))
                    .andReturn();
        });

        Future<MvcResult> second = executor.submit(() -> {
            ready.countDown();
            start.await();
            return mockMvc.perform(post("/api/v1/cashier/registers/" + cashRegisterId + "/close")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("cashAmount", "0.00", "cardAmount", "0.00"))))
                    .andReturn();
        });

        ready.await();
        start.countDown();

        MvcResult firstResult = first.get();
        MvcResult secondResult = second.get();
        executor.shutdown();

        int firstStatus = firstResult.getResponse().getStatus();
        int secondStatus = secondResult.getResponse().getStatus();
        assertThat(firstStatus + secondStatus).isEqualTo(200 + 400);

        MvcResult failedResult = firstStatus == 400 ? firstResult : secondResult;
        String body = failedResult.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(body).satisfiesAnyOf(
                b -> assertThat(b).contains("já está fechado"),
                b -> assertThat(b).contains("já foi fechado ou alterado por outro terminal")
        );

        Integer closedCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM cash_registers WHERE id = ? AND status = 'CLOSED'", Integer.class, cashRegisterId);
        assertThat(closedCount).isEqualTo(1);
    }

    @Test
    @DisplayName("Deve conciliar no fechamento pagamentos vindos tanto do canal e-commerce quanto do PDV (mesa)")
    void shouldReconcilePaymentsFromBothEcommerceAndPdvChannels() throws Exception {
        String token = registerAndGetToken("Multicanal Caixa", "55555555000166", "admin@multicanalcaixa.com");

        MvcResult categoryResult = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CategoryRequest("Geral", "Geral"))))
                .andExpect(status().isCreated())
                .andReturn();
        String categoryId = objectMapper.readTree(categoryResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult productResult = mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProductRequest(
                                "MULTI-01", "Produto Multicanal", new BigDecimal("20.00"), 20, categoryId))))
                .andExpect(status().isCreated())
                .andReturn();
        String productId = objectMapper.readTree(productResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult openCashResult = mockMvc.perform(post("/api/v1/cashier/registers/open")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andReturn();
        String cashRegisterId = objectMapper.readTree(openCashResult.getResponse().getContentAsString()).get("id").asText();

        // Venda pelo canal e-commerce, paga em dinheiro
        MvcResult ecommerceOrderResult = mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateOrderRequest(
                                "cliente-ecommerce",
                                com.portfolio.saas.order.OrderChannel.ECOMMERCE,
                                java.util.List.of(new OrderItemRequest(productId, 1))))))
                .andExpect(status().isCreated())
                .andReturn();
        String ecommerceOrderId = objectMapper.readTree(ecommerceOrderResult.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/payments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "orderId", ecommerceOrderId, "method", "CASH", "amount", "20.00"))))
                .andExpect(status().isCreated());

        // Venda pelo canal PDV (fechamento de mesa), paga em cartão
        MvcResult openTableResult = mockMvc.perform(post("/api/v1/pdv/tables")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("tableNumber", "Mesa 5", "customerName", "Cliente Mesa"))))
                .andExpect(status().isCreated())
                .andReturn();
        String tableId = objectMapper.readTree(openTableResult.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/pdv/tables/" + tableId + "/items")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("productId", productId, "quantity", 1))))
                .andExpect(status().isCreated());

        MvcResult closeTableResult = mockMvc.perform(post("/api/v1/pdv/tables/" + tableId + "/close")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        String pdvOrderId = objectMapper.readTree(closeTableResult.getResponse().getContentAsString()).get("orderId").asText();

        mockMvc.perform(post("/api/v1/payments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "orderId", pdvOrderId, "method", "CARD", "amount", "20.00"))))
                .andExpect(status().isCreated());

        // Fechamento do caixa precisa conciliar os dois canais: 20 em dinheiro (e-commerce) + 20 em cartão (PDV)
        mockMvc.perform(post("/api/v1/cashier/registers/" + cashRegisterId + "/close")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("cashAmount", "20.00", "cardAmount", "20.00"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCash").value(20.00))
                .andExpect(jsonPath("$.totalCard").value(20.00))
                .andExpect(jsonPath("$.cashDifference").value(0.00))
                .andExpect(jsonPath("$.cardDifference").value(0.00));
    }

    @Test
    @DisplayName("Deve listar o histórico de caixas do tenant de forma paginada, do mais recente para o mais antigo")
    void shouldListCashRegisterHistoryPaginated() throws Exception {
        String token = registerAndGetToken("Historico Caixa", "66666666000177", "admin@historicocaixa.com");

        for (int i = 0; i < 3; i++) {
            MvcResult openResult = mockMvc.perform(post("/api/v1/cashier/registers/open")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isCreated())
                    .andReturn();
            String id = objectMapper.readTree(openResult.getResponse().getContentAsString()).get("id").asText();

            mockMvc.perform(post("/api/v1/cashier/registers/" + id + "/close")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("cashAmount", "0.00", "cardAmount", "0.00"))))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get("/api/v1/cashier/registers?page=0&size=2")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
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
