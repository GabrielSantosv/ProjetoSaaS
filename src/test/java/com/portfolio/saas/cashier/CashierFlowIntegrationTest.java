package com.portfolio.saas.cashier;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.saas.auth.dto.RegisterTenantRequest;
import com.portfolio.saas.catalog.dto.CategoryRequest;
import com.portfolio.saas.catalog.dto.ProductRequest;
import com.portfolio.saas.order.dto.CreateOrderRequest;
import com.portfolio.saas.order.dto.OrderItemRequest;
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
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

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

    @AfterEach
    void tearDown() {
        jdbcTemplate.execute("DELETE FROM payments");
        jdbcTemplate.execute("DELETE FROM cash_registers");
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
}
