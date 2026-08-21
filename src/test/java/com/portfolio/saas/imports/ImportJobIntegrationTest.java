package com.portfolio.saas.imports;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.saas.auth.dto.RegisterTenantRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ImportJobIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void tearDown() {
        jdbcTemplate.execute("DELETE FROM import_job_errors");
        jdbcTemplate.execute("DELETE FROM import_jobs");
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

        var result = mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/auth/register-tenant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private void waitForImportCompletion(String jobId) throws InterruptedException {
        for (int attempt = 0; attempt < 50; attempt++) {
            String status = jdbcTemplate.queryForObject(
                    "SELECT status FROM import_jobs WHERE id = ?",
                    String.class,
                    jobId
            );

            if (status != null && (status.equals("COMPLETED") || status.equals("FAILED"))) {
                return;
            }

            Thread.sleep(200L);
        }
    }

    @Test
    @DisplayName("Deve importar CSV em chunks e persistir progresso por job")
    void shouldImportCsvInChunksAndPersistProgress() throws Exception {
        String token = registerAndGetToken("Loja Import", "12345678000199", "admin@lojaimport.com");

        StringBuilder csv = new StringBuilder();
        csv.append("sku,name,price,stock_quantity\n");
        for (int i = 1; i <= 1200; i++) {
            csv.append("SKU-%03d,Produto %d,19.90,5\n".formatted(i, i));
        }

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "produtos.csv",
                MediaType.TEXT_PLAIN_VALUE,
                csv.toString().getBytes(StandardCharsets.UTF_8)
        );

        var result = mockMvc.perform(multipart("/api/v1/imports/upload")
                        .file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isAccepted())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andReturn();

        String jobId = objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
        waitForImportCompletion(jobId);

        Integer rows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM import_jobs WHERE id = ?", Integer.class, jobId);
        assertThat(rows).isEqualTo(1);

        String status = jdbcTemplate.queryForObject("SELECT status FROM import_jobs WHERE id = ?", String.class, jobId);
        assertThat(status).isIn("COMPLETED", "FAILED");

        Integer products = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM products", Integer.class);
        assertThat(products).isGreaterThan(0);
    }

    @Test
    @DisplayName("Deve aceitar SKU duplicado e tratar como upsert atômico sem falhar por concorrência")
    void shouldTreatDuplicateSkuAsAtomicUpsert() throws Exception {
        String token = registerAndGetToken("Loja Duplicada", "98765432000199", "admin@lojaduplicada.com");

        String csv = String.join(System.lineSeparator(),
                "sku,name,price,stock_quantity",
                "SKU-001,Produto A,19.90,5",
                "SKU-001,Produto A Atualizado,21.50,7",
                "SKU-002,Produto B,29.90,10");

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "produtos-duplicados.csv",
                MediaType.TEXT_PLAIN_VALUE,
                csv.getBytes(StandardCharsets.UTF_8)
        );

        var result = mockMvc.perform(multipart("/api/v1/imports/upload")
                        .file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isAccepted())
                .andReturn();

        String jobId = objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
        waitForImportCompletion(jobId);

        String status = jdbcTemplate.queryForObject("SELECT status FROM import_jobs WHERE id = ?", String.class, jobId);
        assertThat(status).isEqualTo("COMPLETED");

        Integer totalProducts = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM products", Integer.class);
        assertThat(totalProducts).isEqualTo(2);

        String stock = jdbcTemplate.queryForObject(
                "SELECT stock_quantity FROM products WHERE tenant_id = (SELECT id FROM tenants WHERE document = ?) AND sku = ?",
                String.class,
                "98765432000199",
                "SKU-001"
        );
        assertThat(stock).isEqualTo("12");
    }

    @Test
    @DisplayName("Deve consultar status do job por endpoint GET")
    void shouldQueryJobStatusByEndpoint() throws Exception {
        String token = registerAndGetToken("Loja Status", "11122233344455", "admin@lojastatus.com");

        String csv = String.join(System.lineSeparator(),
                "sku,name,price,stock_quantity",
                "SKU-010,Produto 10,19.90,3");

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "produtos-status.csv",
                MediaType.TEXT_PLAIN_VALUE,
                csv.getBytes(StandardCharsets.UTF_8)
        );

        var uploadResult = mockMvc.perform(multipart("/api/v1/imports/upload")
                        .file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isAccepted())
                .andReturn();

        String jobId = objectMapper.readTree(uploadResult.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/imports/{id}/status", jobId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
    }

    @Test
    @DisplayName("Deve continuar o job e finalizar mesmo quando um chunk falha por constraint de banco")
    void shouldFinalizeJobWhenOneChunkFailsByDatabaseConstraint() throws Exception {
        String token = registerAndGetToken("Loja Chunk Falha", "55566677788899", "admin@lojachunkfalha.com");

        StringBuilder csv = new StringBuilder();
        csv.append("sku,name,price,stock_quantity\n");

        String veryLongName = "N".repeat(200);
        for (int i = 1; i <= 520; i++) {
            if (i == 1) {
                csv.append("SKU-INVALID,").append(veryLongName).append(",19.90,5\n");
                continue;
            }
            csv.append("SKU-%03d,Produto %d,19.90,5\n".formatted(i, i));
        }

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "produtos-chunk-falha.csv",
                MediaType.TEXT_PLAIN_VALUE,
                csv.toString().getBytes(StandardCharsets.UTF_8)
        );

        var uploadResult = mockMvc.perform(multipart("/api/v1/imports/upload")
                        .file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isAccepted())
                .andReturn();

        String jobId = objectMapper.readTree(uploadResult.getResponse().getContentAsString()).get("id").asText();
        waitForImportCompletion(jobId);

        String status = jdbcTemplate.queryForObject("SELECT status FROM import_jobs WHERE id = ?", String.class, jobId);
        assertThat(status).isIn("COMPLETED", "FAILED");
        assertThat(status).isEqualTo("FAILED");

        Long processedRows = jdbcTemplate.queryForObject("SELECT processed_rows FROM import_jobs WHERE id = ?", Long.class, jobId);
        assertThat(processedRows).isGreaterThan(0L);

        Long errorCount = jdbcTemplate.queryForObject("SELECT error_count FROM import_jobs WHERE id = ?", Long.class, jobId);
        assertThat(errorCount).isGreaterThan(0L);
    }

    @Test
    @DisplayName("Deve falhar claramente quando o tenant não está disponível no contexto")
    void shouldFailClearlyWhenTenantContextIsMissing() {
        var jobService = new ProductImportService(null, null, null, null);
        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class, () ->
                jobService.validateTenantContext());
    }
}
