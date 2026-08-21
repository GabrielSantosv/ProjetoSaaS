package com.portfolio.saas.catalog;

import com.portfolio.saas.catalog.dto.ProductRequest;
import com.portfolio.saas.catalog.dto.ProductResponse;
import com.portfolio.saas.tenant.Tenant;
import com.portfolio.saas.tenant.TenantContext;
import com.portfolio.saas.tenant.TenantRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class ProductStockConcurrencyTest {

    @Autowired
    private ProductService productService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @BeforeEach
    void setTenant() {
        Tenant tenant = tenantRepository.save(new Tenant(null, "Tenant Concorrência", "11111111000101", "PRO", true));
        TenantContext.setTenantId(tenant.getId());
    }

    @AfterEach
    void cleanup() {
        productRepository.deleteAll();
        tenantRepository.deleteAll();
        TenantContext.clear();
    }

    @Test
    @DisplayName("Deve manter o estoque consistente com múltiplas decreções concorrentes para o mesmo produto")
    void shouldKeepStockConsistentAcrossConcurrentAdjustments() throws Exception {
        Product product = new Product(
                "SKU-CONC-01",
                "Produto Concorrente",
                new BigDecimal("19.90"),
                20,
                null
        );
        product = productRepository.save(product);

        String tenantId = TenantContext.getTenantId();
        int threads = 10;
        int deltaPerThread = -2;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<ProductResponse>> futures = new ArrayList<>();

        String productId = product.getId();
        for (int i = 0; i < threads; i++) {
            futures.add(executor.submit(() -> {
                TenantContext.setTenantId(tenantId);
                try {
                    ready.countDown();
                    start.await();
                    return productService.updateStock(productId, deltaPerThread);
                } finally {
                    TenantContext.clear();
                }
            }));
        }

        ready.await();
        start.countDown();

        for (Future<ProductResponse> future : futures) {
            future.get();
        }

        executor.shutdown();

        Product refreshed = productRepository.findByIdScoped(product.getId()).orElseThrow();
        assertThat(refreshed.getStockQuantity()).isEqualTo(0);
    }
}
