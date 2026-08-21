package com.portfolio.saas;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class SaasApplicationTests {

    @Test
    @DisplayName("Deve carregar o contexto da aplicação e aplicar migrations com sucesso no H2")
    void contextLoads() {
        // Valida que todos os beans, configurações e migrations do Flyway executam perfeitamente
    }
}
