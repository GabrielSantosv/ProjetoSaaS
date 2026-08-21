package com.portfolio.saas.tenant;

import com.portfolio.saas.auth.Role;
import com.portfolio.saas.auth.User;
import com.portfolio.saas.auth.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class MultiTenancyDataIsolationTest {

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        jdbcTemplate.execute("DELETE FROM users");
        jdbcTemplate.execute("DELETE FROM tenants");
    }

    @Test
    @DisplayName("Garante que o @TenantId do Hibernate isola completamente consultas entre diferentes tenants")
    void shouldIsolateDataBetweenTenantsAutomatically() {
        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);

        // 1. Criar Tenant A e Tenant B
        Tenant tenantA = tenantRepository.save(new Tenant(null, "Empresa A", "11111111000101", "PRO", true));
        Tenant tenantB = tenantRepository.save(new Tenant(null, "Empresa B", "22222222000102", "PRO", true));

        // 2. Operar no contexto do Tenant A
        TenantContext.setTenantId(tenantA.getId());
        txTemplate.executeWithoutResult(status -> {
            User userA = new User("Vendedor Tenant A", "vendedor@empresa-a.com", "hash", Role.ROLE_SELLER);
            userA.setTenantId(tenantA.getId());
            userRepository.save(userA);
        });

        txTemplate.executeWithoutResult(status -> {
            List<User> usersInTenantA = userRepository.findAll();
            assertThat(usersInTenantA)
                    .extracting(User::getEmail)
                    .contains("vendedor@empresa-a.com");
        });

        // 3. Mudar o contexto para o Tenant B
        TenantContext.setTenantId(tenantB.getId());

        // A consulta via JPA do Spring Data DEVE retornar apenas dados do Tenant B (sem vazar dados do Tenant A)
        txTemplate.executeWithoutResult(status -> {
            List<User> usersInTenantB = userRepository.findAll();
            assertThat(usersInTenantB)
                    .extracting(User::getEmail)
                    .doesNotContain("vendedor@empresa-a.com");
        });

        // Criar usuário no Tenant B
        txTemplate.executeWithoutResult(status -> {
            User userB = new User("Gerente Tenant B", "gerente@empresa-b.com", "hash", Role.ROLE_ADMIN);
            userB.setTenantId(tenantB.getId());
            userRepository.save(userB);
        });

        txTemplate.executeWithoutResult(status -> {
            List<User> usersInTenantB = userRepository.findAll();
            assertThat(usersInTenantB)
                    .extracting(User::getEmail)
                    .contains("gerente@empresa-b.com")
                    .doesNotContain("vendedor@empresa-a.com");
        });
    }
}
