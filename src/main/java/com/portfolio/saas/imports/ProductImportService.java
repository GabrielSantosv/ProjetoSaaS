package com.portfolio.saas.imports;

import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.common.exception.ResourceNotFoundException;
import com.portfolio.saas.tenant.TenantContext;
import io.github.resilience4j.core.IntervalFunction;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.sql.PreparedStatement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class ProductImportService {

    private static final int CHUNK_SIZE = 500;

    private final ImportJobRepository importJobRepository;
    private final ImportJobErrorRepository importJobErrorRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ExecutorService virtualThreadPerTaskExecutor;
    private final Retry importRetry;

    public ProductImportService(
            ImportJobRepository importJobRepository,
            ImportJobErrorRepository importJobErrorRepository,
            JdbcTemplate jdbcTemplate,
            ExecutorService virtualThreadPerTaskExecutor
    ) {
        this.importJobRepository = importJobRepository;
        this.importJobErrorRepository = importJobErrorRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.virtualThreadPerTaskExecutor = virtualThreadPerTaskExecutor;
        this.importRetry = Retry.of(
                "importBatchRetry",
                RetryConfig.custom()
                        .maxAttempts(3)
                        .intervalFunction(IntervalFunction.ofExponentialBackoff(200L, 2.0))
                        .retryExceptions(
                                org.springframework.dao.TransientDataAccessException.class,
                                org.springframework.dao.CannotAcquireLockException.class,
                                org.springframework.dao.DeadlockLoserDataAccessException.class,
                                java.sql.SQLTransientException.class,
                                java.sql.SQLTimeoutException.class
                        )
                        .build()
        );
    }

    public void validateTenantContext() {
        if (!TenantContext.hasTenant()) {
            throw new IllegalStateException("Tentativa de importação bloqueada: nenhum tenant ativo no TenantContext.");
        }
    }

    public ImportJob getImportStatus(String jobId) {
        return importJobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job de importação não encontrado: " + jobId));
    }

    @Transactional
    public ImportJob createImportJob(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("Arquivo de importação vazio ou inexistente.");
        }

        validateTenantContext();

        String fileName = file.getOriginalFilename() == null || file.getOriginalFilename().isBlank()
                ? "import-" + UUID.randomUUID() + ".csv"
                : file.getOriginalFilename();

        Path targetDir = Paths.get(System.getProperty("java.io.tmpdir"), "saas-imports");
        try {
            Files.createDirectories(targetDir);
            String safeName = UUID.randomUUID() + "-" + fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
            Path targetPath = targetDir.resolve(safeName);
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

            ImportJob job = new ImportJob(fileName, targetPath.toString());
            job = importJobRepository.save(job);
            return job;
        } catch (IOException e) {
            throw new BusinessException("Não foi possível gravar o arquivo de importação em disco local.", e);
        }
    }

    @Async("virtualThreadPerTaskExecutor")
    @Transactional
    public void processImportAsync(String jobId) {
        processImport(jobId);
    }

    @Transactional
    public void processImport(String jobId) {
        ImportJob job = importJobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job de importação não encontrado: " + jobId));

        String tenantId = job.getTenantId();
        TenantContext.setTenantId(tenantId);

        try {
            job.setStatus(ImportJobStatus.PROCESSING);
            job.setMessage("Processando arquivo CSV...");
            importJobRepository.save(job);

            Path filePath = Paths.get(job.getStoredPath());
            if (!Files.exists(filePath)) {
                throw new BusinessException("Arquivo armazenado não encontrado para processamento: " + job.getStoredPath());
            }

            List<List<CsvRow>> chunks = readChunks(filePath);
            long totalRows = chunks.stream().mapToLong(List::size).sum();
            job.setTotalRows(totalRows);
            importJobRepository.save(job);

            AtomicLong processed = new AtomicLong();
            AtomicLong success = new AtomicLong();
            AtomicLong errors = new AtomicLong();

            List<CompletableFuture<Void>> futures = new ArrayList<>();
            final ImportJob jobForChunks = job;
            for (List<CsvRow> chunk : chunks) {
                final List<CsvRow> chunkForThread = chunk;
                futures.add(CompletableFuture.runAsync(() -> processChunk(jobForChunks, chunkForThread, processed, success, errors), virtualThreadPerTaskExecutor));
            }

            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

            job = importJobRepository.findById(jobId).orElseThrow();
            long processedTotal = processed.get();
            long successTotal = success.get();
            long errorTotal = errors.get();

            ImportJobStatus finalStatus = errorTotal == 0 ? ImportJobStatus.COMPLETED : ImportJobStatus.FAILED;
            String message = errorTotal == 0
                    ? "Importação concluída com sucesso."
                    : "Importação concluída com erros em algumas linhas.";

            importJobRepository.updateCounters(jobId, processedTotal, successTotal, errorTotal, finalStatus);
            importJobRepository.markStatus(jobId, finalStatus, message);

            job.setProcessedRows(processedTotal);
            job.setSuccessCount(successTotal);
            job.setErrorCount(errorTotal);
            job.setStatus(finalStatus);
            job.setMessage(message);
            importJobRepository.save(job);
        } finally {
            TenantContext.clear();
        }
    }

    private void processChunk(ImportJob job, List<CsvRow> rows, AtomicLong processed, AtomicLong success, AtomicLong errors) {
        TenantContext.setTenantId(job.getTenantId());

        try {
            List<ProductImportLine> validRows = new ArrayList<>();
            for (CsvRow row : rows) {
                try {
                    validRows.add(toProductImportLine(job, row));
                } catch (Exception ex) {
                    processed.incrementAndGet();
                    errors.incrementAndGet();
                    saveError(job, row.lineNumber(), ex.getMessage());
                    jdbcTemplate.update(
                            "UPDATE import_jobs SET processed_rows = processed_rows + ?, error_count = error_count + ? WHERE id = ?",
                            1,
                            1,
                            job.getId()
                    );
                }
            }

            if (!validRows.isEmpty()) {
                try {
                    Retry.decorateRunnable(importRetry, () -> batchUpsertProducts(validRows)).run();
                    processed.addAndGet(validRows.size());
                    success.addAndGet(validRows.size());
                    jdbcTemplate.update(
                            "UPDATE import_jobs SET processed_rows = processed_rows + ?, success_count = success_count + ? WHERE id = ?",
                            validRows.size(),
                            validRows.size(),
                            job.getId()
                    );
                } catch (Exception ex) {
                    processed.addAndGet(validRows.size());
                    errors.addAndGet(validRows.size());

                    for (ProductImportLine row : validRows) {
                        saveError(job, row.lineNumber(), ex.getMessage() == null ? "Erro ao processar lote do arquivo." : ex.getMessage());
                    }

                    jdbcTemplate.update(
                            "UPDATE import_jobs SET processed_rows = processed_rows + ?, error_count = error_count + ? WHERE id = ?",
                            validRows.size(),
                            validRows.size(),
                            job.getId()
                    );
                }
            }
        } finally {
            TenantContext.clear();
        }
    }

    private ProductImportLine toProductImportLine(ImportJob job, CsvRow row) {
        String sku = row.sku() == null ? "" : row.sku().trim();
        String name = row.name() == null ? "" : row.name().trim();
        String tenantId = job.getTenantId();

        if (sku.isBlank() || name.isBlank()) {
            throw new IllegalArgumentException("SKU e nome do produto são obrigatórios.");
        }

        BigDecimal price;
        try {
            price = new BigDecimal(row.price());
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("Preço inválido na linha " + row.lineNumber() + ": " + row.price(), ex);
        }

        int stockQuantity;
        try {
            stockQuantity = Integer.parseInt(row.stockQuantity());
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("Quantidade em estoque inválida na linha " + row.lineNumber() + ": " + row.stockQuantity(), ex);
        }

        if (price.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Preço deve ser maior que zero.");
        }

        if (stockQuantity < 0) {
            throw new IllegalArgumentException("Quantidade em estoque não pode ser negativa.");
        }

        return new ProductImportLine(UUID.randomUUID().toString(), tenantId, sku, name, price, stockQuantity, row.lineNumber());
    }

    private void batchUpsertProducts(List<ProductImportLine> rows) {
        String sql = "INSERT INTO products (id, tenant_id, sku, name, price, stock_quantity, category_id, created_at, updated_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
                "ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), stock_quantity = stock_quantity + VALUES(stock_quantity), updated_at = CURRENT_TIMESTAMP";

        jdbcTemplate.batchUpdate(sql, rows, 100, (PreparedStatement ps, ProductImportLine row) -> {
            ps.setString(1, row.id());
            ps.setString(2, row.tenantId());
            ps.setString(3, row.sku());
            ps.setString(4, row.name());
            ps.setBigDecimal(5, row.price());
            ps.setInt(6, row.stockQuantity());
            ps.setNull(7, java.sql.Types.VARCHAR);
        });
    }

    private record ProductImportLine(String id, String tenantId, String sku, String name, BigDecimal price, int stockQuantity, long lineNumber) {}

    private void saveError(ImportJob job, long rowNumber, String message) {
        TenantContext.setTenantId(job.getTenantId());
        try {
            jdbcTemplate.update(
                    "INSERT INTO import_job_errors (id, tenant_id, import_job_id, row_number, error_message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                    UUID.randomUUID().toString(),
                    job.getTenantId(),
                    job.getId(),
                    rowNumber,
                    message == null ? "Erro desconhecido" : message
            );
        } finally {
            TenantContext.clear();
        }
    }

    private List<List<CsvRow>> readChunks(Path filePath) {
        List<List<CsvRow>> chunks = new ArrayList<>();
        List<CsvRow> currentChunk = new ArrayList<>(CHUNK_SIZE);

        try (var reader = Files.newBufferedReader(filePath, StandardCharsets.UTF_8)) {
            String line;
            long lineNumber = 0L;
            boolean skipHeader = false;

            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (!skipHeader) {
                    skipHeader = true;
                    continue;
                }

                if (line.isBlank()) {
                    continue;
                }

                String[] parts = line.split(",", -1);
                if (parts.length < 4) {
                    throw new IllegalArgumentException("Linha " + lineNumber + " inválida: quantidade de colunas insuficiente.");
                }

                currentChunk.add(new CsvRow(lineNumber, parts[0].trim(), parts[1].trim(), parts[2].trim(), parts[3].trim()));
                if (currentChunk.size() == CHUNK_SIZE) {
                    chunks.add(new ArrayList<>(currentChunk));
                    currentChunk.clear();
                }
            }
        } catch (IOException e) {
            throw new BusinessException("Erro ao ler o arquivo de importação para processamento.", e);
        }

        if (!currentChunk.isEmpty()) {
            chunks.add(currentChunk);
        }

        return chunks;
    }

    private record CsvRow(long lineNumber, String sku, String name, String price, String stockQuantity) {
    }
}
