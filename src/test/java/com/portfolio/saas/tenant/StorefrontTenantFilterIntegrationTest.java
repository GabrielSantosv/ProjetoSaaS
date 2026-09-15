package com.portfolio.saas.tenant;

import com.portfolio.saas.catalog.Category;
import com.portfolio.saas.catalog.CategoryRepository;
import com.portfolio.saas.catalog.Product;
import com.portfolio.saas.catalog.ProductRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verificação end-to-end (HTTP real, cadeia de filtros real, sem mock de segurança) de que:
 * 1) uma requisição do storefront SEM JWT chega ao controller com o tenant correto resolvido
 *    via StorefrontTenantFilter, e o Hibernate de fato filtra pelos dados DESSE tenant;
 * 2) essa mesma ausência de JWT continua sendo rejeitada nas rotas internas autenticadas —
 *    ou seja, abrir o storefront não abriu nada além do prefixo "/api/v1/storefront/**";
 * 3) um JWT válido de OUTRO tenant, anexado por engano ou de propósito a uma chamada do
 *    storefront, NÃO troca o tenant servido — o storefront sempre serve o tenant fixo.
 *
 * Isso existe porque ordem de filtro + ThreadLocal é exatamente o tipo de coisa que "parece
 * certa" na leitura do código e só a execução real confirma (mesma lição do bug de flush do
 * Hibernate na Fase 5).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "storefront.tenant-id=storefront-test-tenant")
class StorefrontTenantFilterIntegrationTest {

    private static final String TENANT_ID = "storefront-test-tenant";
    private static final String OTHER_TENANT_ID = "other-tenant-not-in-storefront";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private String storefrontProductId;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(TENANT_ID);
        Tenant tenant = tenantRepository.save(new Tenant(TENANT_ID, "Loja do Storefront", "11122233344455", "PRO", true));
        Category category = new Category("Vinhos", "Vinhos selecionados");
        category.setTenantId(tenant.getId());
        category = categoryRepository.save(category);

        Product visible = new Product("SKU-SF-01", "Malbec de altitude", new BigDecimal("148.00"), 10, category);
        visible.setTenantId(tenant.getId());
        visible = productRepository.save(visible);
        storefrontProductId = visible.getId();
        TenantContext.clear();

        // Segundo tenant, DIFERENTE do configurado em storefront.tenant-id — prova de que o
        // storefront não vaza dados de outro tenant mesmo que ele também exista no banco.
        TenantContext.setTenantId(OTHER_TENANT_ID);
        Tenant otherTenant = tenantRepository.save(new Tenant(OTHER_TENANT_ID, "Outra Loja", "99988877766655", "PRO", true));
        Category otherCategory = new Category("Eletrônicos", "Outra categoria");
        otherCategory.setTenantId(otherTenant.getId());
        otherCategory = categoryRepository.save(otherCategory);
        Product otherProduct = new Product("SKU-OT-01", "Produto de outro tenant", new BigDecimal("10.00"), 5, otherCategory);
        otherProduct.setTenantId(otherTenant.getId());
        productRepository.save(otherProduct);
        TenantContext.clear();
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.execute("DELETE FROM order_items");
        jdbcTemplate.execute("DELETE FROM orders");
        jdbcTemplate.execute("DELETE FROM products");
        jdbcTemplate.execute("DELETE FROM categories");
        jdbcTemplate.execute("DELETE FROM users");
        jdbcTemplate.execute("DELETE FROM tenants");
    }

    @Test
    @DisplayName("Requisição HTTP real ao storefront, sem Authorization, resolve o tenant fixo e retorna só o catálogo dele")
    void storefrontRequestWithoutJwtResolvesConfiguredTenant() throws Exception {
        mockMvc.perform(get("/api/v1/storefront/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].name").value("Malbec de altitude"))
                .andExpect(jsonPath("$.content[0].id").value(storefrontProductId));
    }

    @Test
    @DisplayName("Rota interna autenticada continua exigindo JWT mesmo com o filtro do storefront registrado")
    void internalProductRouteStillRequiresJwt() throws Exception {
        // 403, não 401: comportamento padrão pré-existente do Spring Security 6 nesta
        // SecurityConfig (autenticação anônima + nenhum AuthenticationEntryPoint customizado),
        // sem relação com o StorefrontTenantFilter. O que importa aqui é que NÃO é 200.
        mockMvc.perform(get("/api/v1/products"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Carrinho do storefront via HTTP real: adicionar item resolve o produto do tenant certo, sem JWT")
    void storefrontCartAddItemResolvesCorrectTenantProduct() throws Exception {
        mockMvc.perform(post("/api/v1/storefront/cart/visitor-1/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + storefrontProductId + "\",\"quantity\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].productName").value("Malbec de altitude"))
                .andExpect(jsonPath("$.total").value(296.00));
    }

    @Test
    @DisplayName("Regressão: um JWT válido de OUTRO tenant anexado à chamada do storefront não deve trocar o tenant servido")
    void storefrontRequestWithForeignValidJwtStillResolvesConfiguredTenant() throws Exception {
        // Bug real encontrado em auditoria: como o TenantFilter roda para toda requisição
        // autenticada (não sabe que "/api/v1/storefront/**" é público), um JWT válido de
        // QUALQUER outro tenant setava o TenantContext para esse tenant antes do controller
        // rodar. Corrigido registrando o StorefrontTenantFilter DEPOIS do TenantFilter na
        // cadeia (addFilterAfter), para ter a palavra final. Este teste usa um tenant de
        // verdade, criado via /api/v1/auth/register-tenant (sem produtos), e prova que o
        // catálogo devolvido continua sendo o do storefront fixo (Malbec), nunca um catálogo
        // vazio do tenant do JWT nem 403 — a chamada é pública e o tenant é sempre o fixo.
        String registerBody = """
                {"companyName":"Tenant Estranho","document":"99911122233344","planId":"PRO",
                 "adminName":"Admin Estranho","adminEmail":"admin.estranho@test.com","adminPassword":"senha123456"}
                """;

        String response = mockMvc.perform(post("/api/v1/auth/register-tenant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String foreignToken = response.replaceAll(".*\"accessToken\":\"([^\"]+)\".*", "$1");

        mockMvc.perform(get("/api/v1/storefront/products")
                        .header("Authorization", "Bearer " + foreignToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].name").value("Malbec de altitude"))
                .andExpect(jsonPath("$.content[0].id").value(storefrontProductId));

        jdbcTemplate.execute("DELETE FROM users WHERE email = 'admin.estranho@test.com'");
        jdbcTemplate.execute("DELETE FROM tenants WHERE document = '99911122233344'");
    }
}
