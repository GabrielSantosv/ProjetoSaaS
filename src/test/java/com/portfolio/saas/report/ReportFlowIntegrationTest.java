package com.portfolio.saas.report;

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
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ReportFlowIntegrationTest {

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
        jdbcTemplate.execute("DELETE FROM import_job_errors");
        jdbcTemplate.execute("DELETE FROM import_jobs");
        jdbcTemplate.execute("DELETE FROM products");
        jdbcTemplate.execute("DELETE FROM categories");
        jdbcTemplate.execute("DELETE FROM users");
        jdbcTemplate.execute("DELETE FROM tenants");
    }

    private String registerAndGetToken(String companyName, String document, String email) throws Exception {
        RegisterTenantRequest request = new RegisterTenantRequest(
                companyName, document, "PRO", "Admin " + companyName, email, "senha123"
        );
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register-tenant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private String loginAndGetToken(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private String createProduct(String token, String sku, String name, BigDecimal price, int stock) throws Exception {
        MvcResult categoryResult = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CategoryRequest("Geral " + sku, "Geral"))))
                .andExpect(status().isCreated())
                .andReturn();
        String categoryId = objectMapper.readTree(categoryResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult productResult = mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProductRequest(sku, name, price, stock, categoryId))))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(productResult.getResponse().getContentAsString()).get("id").asText();
    }

    private String createOrderAndPay(String token, String productId, String customerId,
                                      com.portfolio.saas.order.OrderChannel channel, BigDecimal amount) throws Exception {
        MvcResult orderResult = mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateOrderRequest(
                                customerId, channel, List.of(new OrderItemRequest(productId, 1))))))
                .andExpect(status().isCreated())
                .andReturn();
        String orderId = objectMapper.readTree(orderResult.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/payments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "orderId", orderId, "method", "CASH", "amount", amount.toPlainString()))))
                .andExpect(status().isCreated());
        return orderId;
    }

    @Test
    @DisplayName("Deve agregar faturamento, pedidos e ticketMedio de hoje a partir de pagamentos reais")
    void shouldAggregateFaturamentoPedidosETicketMedioToday() throws Exception {
        String token = registerAndGetToken("Report Basico", "20202020000111", "admin@reportbasico.com");
        String productId = createProduct(token, "REP-01", "Item Report", new BigDecimal("40.00"), 10);

        createOrderAndPay(token, productId, "cli-1", com.portfolio.saas.order.OrderChannel.ECOMMERCE, new BigDecimal("40.00"));
        createOrderAndPay(token, productId, "cli-2", com.portfolio.saas.order.OrderChannel.ECOMMERCE, new BigDecimal("40.00"));

        mockMvc.perform(get("/api/v1/reports/dashboard?period=TODAY")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.faturamento").value(80.00))
                .andExpect(jsonPath("$.pedidos").value(2))
                .andExpect(jsonPath("$.ticketMedio").value(40.00));
    }

    @Test
    @DisplayName("Deve tratar divisao por zero graciosamente quando nao ha pedidos no periodo")
    void shouldHandleZeroOrdersGracefully() throws Exception {
        String token = registerAndGetToken("Report Vazio", "20202020000122", "admin@reportvazio.com");

        mockMvc.perform(get("/api/v1/reports/dashboard?period=TODAY")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.faturamento").value(0))
                .andExpect(jsonPath("$.pedidos").value(0))
                .andExpect(jsonPath("$.ticketMedio").value(0))
                .andExpect(jsonPath("$.novosClientes").value(0))
                .andExpect(jsonPath("$.faturamentoPorDia").isArray())
                .andExpect(jsonPath("$.faturamentoPorDia.length()").value(0));
    }

    @Test
    @DisplayName("Deve excluir pedido cancelado do faturamento e da contagem de pedidos")
    void shouldExcludeCancelledOrderFromFaturamento() throws Exception {
        String token = registerAndGetToken("Report Cancelado", "20202020000133", "admin@reportcancelado.com");
        String productId = createProduct(token, "REP-02", "Item Cancelavel", new BigDecimal("25.00"), 10);

        MvcResult orderResult = mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateOrderRequest(
                                "cli-cancel", com.portfolio.saas.order.OrderChannel.ECOMMERCE,
                                List.of(new OrderItemRequest(productId, 1))))))
                .andExpect(status().isCreated())
                .andReturn();
        String orderId = objectMapper.readTree(orderResult.getResponse().getContentAsString()).get("id").asText();

        String orderStatus = jdbcTemplate.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, orderId);
        assertThat(orderStatus).isEqualTo("CONFIRMED");

        // Cancela o pedido sem pagar
        jdbcTemplate.update("UPDATE orders SET status = 'CANCELLED' WHERE id = ?", orderId);

        mockMvc.perform(get("/api/v1/reports/dashboard?period=TODAY")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.faturamento").value(0))
                .andExpect(jsonPath("$.pedidos").value(0));
    }

    @Test
    @DisplayName("Deve bloquear PDV (USER) com 403 e permitir ADMIN/SELLER/CASHIER no dashboard")
    void shouldEnforceRoleBasedAccessOnDashboard() throws Exception {
        String adminToken = registerAndGetToken("RBAC Dashboard", "20202020000144", "admin@rbacdashboard.com");
        String tenantId = jdbcTemplate.queryForObject("SELECT tenant_id FROM users WHERE email = ?", String.class, "admin@rbacdashboard.com");

        TenantContext.setTenantId(tenantId);
        try {
            userRepository.save(new User("Vendedor RBAC", "vendedor@rbacdashboard.com", passwordEncoder.encode("senha123"), Role.ROLE_SELLER));
            userRepository.save(new User("Caixa RBAC", "caixa@rbacdashboard.com", passwordEncoder.encode("senha123"), Role.ROLE_CASHIER));
            userRepository.save(new User("Usuario RBAC", "usuario@rbacdashboard.com", passwordEncoder.encode("senha123"), Role.ROLE_USER));
        } finally {
            TenantContext.clear();
        }

        String sellerToken = loginAndGetToken("vendedor@rbacdashboard.com", "senha123");
        String cashierToken = loginAndGetToken("caixa@rbacdashboard.com", "senha123");
        String userToken = loginAndGetToken("usuario@rbacdashboard.com", "senha123");

        mockMvc.perform(get("/api/v1/reports/dashboard?period=TODAY").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/reports/dashboard?period=TODAY").header("Authorization", "Bearer " + sellerToken))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/reports/dashboard?period=TODAY").header("Authorization", "Bearer " + cashierToken))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/reports/dashboard?period=TODAY").header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Deve agregar receitaPorCanal separando e-commerce de PDV corretamente, sem misturar os dois")
    void shouldAggregateRevenueByChannelSeparately() throws Exception {
        String token = registerAndGetToken("Report Canal", "20202020000155", "admin@reportcanal.com");
        String productId = createProduct(token, "REP-03", "Item Canal", new BigDecimal("35.00"), 10);

        // Venda e-commerce
        createOrderAndPay(token, productId, "cli-ecommerce-canal", com.portfolio.saas.order.OrderChannel.ECOMMERCE, new BigDecimal("35.00"));

        // Venda PDV via fechamento de mesa
        MvcResult openTableResult = mockMvc.perform(post("/api/v1/pdv/tables")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("tableNumber", "Mesa 9", "customerName", "Cliente Mesa Report"))))
                .andExpect(status().isCreated())
                .andReturn();
        String tableId = objectMapper.readTree(openTableResult.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/pdv/tables/" + tableId + "/items")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("productId", productId, "quantity", 2))))
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
                                "orderId", pdvOrderId, "method", "CARD", "amount", "70.00"))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/reports/dashboard?period=TODAY")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.faturamento").value(105.00))
                .andExpect(jsonPath("$.receitaPorCanal.ecommerce").value(35.00))
                .andExpect(jsonPath("$.receitaPorCanal.pdv").value(70.00));
    }

    @Test
    @DisplayName("novosClientes deve contar apenas customerId de e-commerce, ignorando customerId sintetico do PDV")
    void shouldCountOnlyEcommerceCustomersAsNewCustomers() throws Exception {
        String token = registerAndGetToken("Report Novos Clientes", "20202020000166", "admin@reportnovosclientes.com");
        String productId = createProduct(token, "REP-04", "Item Novos Clientes", new BigDecimal("15.00"), 10);

        // 2 clientes novos de e-commerce hoje
        createOrderAndPay(token, productId, "cli-novo-1", com.portfolio.saas.order.OrderChannel.ECOMMERCE, new BigDecimal("15.00"));
        createOrderAndPay(token, productId, "cli-novo-2", com.portfolio.saas.order.OrderChannel.ECOMMERCE, new BigDecimal("15.00"));

        // 1 mesa PDV — customerId sintético (table-N-xxxx), não deve contar como "novo cliente"
        MvcResult openTableResult = mockMvc.perform(post("/api/v1/pdv/tables")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("tableNumber", "Mesa 11", "customerName", "Cliente Mesa NC"))))
                .andExpect(status().isCreated())
                .andReturn();
        String tableId = objectMapper.readTree(openTableResult.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/pdv/tables/" + tableId + "/items")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("productId", productId, "quantity", 1))))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/pdv/tables/" + tableId + "/close")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/reports/dashboard?period=TODAY")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.novosClientes").value(2));
    }

    @Test
    @DisplayName("Um segundo pedido do mesmo cliente e-commerce, num periodo posterior, nao deve contar como novo cliente de novo")
    void shouldNotCountReturningCustomerAsNewAgain() throws Exception {
        String token = registerAndGetToken("Report Cliente Recorrente", "20202020000177", "admin@reportrecorrente.com");
        String productId = createProduct(token, "REP-05", "Item Recorrente", new BigDecimal("10.00"), 10);

        // Primeiro pedido do cliente hoje -> primeira conversao, conta como novo
        createOrderAndPay(token, productId, "cli-recorrente", com.portfolio.saas.order.OrderChannel.ECOMMERCE, new BigDecimal("10.00"));

        // Segundo pedido do MESMO cliente, ainda hoje -> ja nao e mais a primeira conversao
        createOrderAndPay(token, productId, "cli-recorrente", com.portfolio.saas.order.OrderChannel.ECOMMERCE, new BigDecimal("10.00"));

        mockMvc.perform(get("/api/v1/reports/dashboard?period=TODAY")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.novosClientes").value(1))
                .andExpect(jsonPath("$.pedidos").value(2));
    }

    @Test
    @DisplayName("Pedido criado as 23:59:59 de ontem nao deve cair no periodo TODAY; as 00:00:01 de hoje deve cair")
    void shouldRespectMidnightBoundaryForTodayPeriod() throws Exception {
        String token = registerAndGetToken("Report Meia Noite", "20202020000188", "admin@reportmeianoite.com");
        String productId = createProduct(token, "REP-06", "Item Meia Noite", new BigDecimal("50.00"), 10);

        String yesterdayOrderId = createOrderAndPay(token, productId, "cli-meianoite-ontem", com.portfolio.saas.order.OrderChannel.ECOMMERCE, new BigDecimal("50.00"));
        String todayOrderId = createOrderAndPay(token, productId, "cli-meianoite-hoje", com.portfolio.saas.order.OrderChannel.ECOMMERCE, new BigDecimal("50.00"));

        // Força o timestamp do pedido/pagamento de "ontem" para 23:59:59.999 do dia anterior
        jdbcTemplate.update("UPDATE orders SET created_at = DATEADD('DAY', -1, CURRENT_DATE) + INTERVAL '23:59:59.999' HOUR TO SECOND WHERE id = ?", yesterdayOrderId);
        jdbcTemplate.update("UPDATE payments SET created_at = DATEADD('DAY', -1, CURRENT_DATE) + INTERVAL '23:59:59.999' HOUR TO SECOND WHERE order_id = ?", yesterdayOrderId);

        // Força o timestamp do pedido/pagamento de "hoje" para 00:00:01 do dia atual
        jdbcTemplate.update("UPDATE orders SET created_at = CURRENT_DATE + INTERVAL '00:00:01' HOUR TO SECOND WHERE id = ?", todayOrderId);
        jdbcTemplate.update("UPDATE payments SET created_at = CURRENT_DATE + INTERVAL '00:00:01' HOUR TO SECOND WHERE order_id = ?", todayOrderId);

        mockMvc.perform(get("/api/v1/reports/dashboard?period=TODAY")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.faturamento").value(50.00))
                .andExpect(jsonPath("$.pedidos").value(1));
    }

    @Test
    @DisplayName("Deve refletir os tres mini-cards operacionais (catalogo, importacao, operacao) em tempo real, independente do periodo")
    void shouldReflectOperationalMiniCards() throws Exception {
        String token = registerAndGetToken("Report Operacional", "20202020000199", "admin@reportoperacional.com");
        String activeProductId = createProduct(token, "REP-07", "Item Ativo", new BigDecimal("12.00"), 5);
        String outOfStockProductId = createProduct(token, "REP-08", "Item Sem Estoque", new BigDecimal("12.00"), 0);
        jdbcTemplate.update("UPDATE products SET status = 'OUT_OF_STOCK' WHERE id = ?", outOfStockProductId);
        String draftProductId = createProduct(token, "REP-09", "Item Rascunho", new BigDecimal("12.00"), 5);
        jdbcTemplate.update("UPDATE products SET status = 'DRAFT' WHERE id = ?", draftProductId);

        String tenantId = jdbcTemplate.queryForObject("SELECT tenant_id FROM users WHERE email = ?", String.class, "admin@reportoperacional.com");
        jdbcTemplate.update("INSERT INTO import_jobs (id, tenant_id, file_name, stored_path, status, success_count, error_count) " +
                        "VALUES (?, ?, 'produtos.csv', '/tmp/produtos.csv', 'COMPLETED', 120, 7)",
                java.util.UUID.randomUUID().toString(), tenantId);

        mockMvc.perform(post("/api/v1/pdv/tables")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("tableNumber", "Mesa 3", "customerName", "Cliente Operacional"))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/reports/dashboard?period=TODAY")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.operacional.produtosAtivos").value(1))
                .andExpect(jsonPath("$.operacional.produtosSemEstoque").value(1))
                .andExpect(jsonPath("$.operacional.produtosRascunho").value(1))
                .andExpect(jsonPath("$.operacional.arquivosImportadosHoje").value(1))
                .andExpect(jsonPath("$.operacional.linhasImportadasHoje").value(120))
                .andExpect(jsonPath("$.operacional.linhasComErroHoje").value(7))
                .andExpect(jsonPath("$.operacional.mesasOcupadas").value(1));
    }
}
