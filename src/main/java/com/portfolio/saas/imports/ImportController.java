package com.portfolio.saas.imports;

import com.portfolio.saas.common.dto.PageResponse;
import com.portfolio.saas.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/imports")
@Tag(name = "Importação em Lote", description = "Upload e processamento de CSV em massa por tenant")
@SecurityRequirement(name = "bearerAuth")
public class ImportController {

    private final ProductImportService productImportService;

    public ImportController(ProductImportService productImportService) {
        this.productImportService = productImportService;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Upload de CSV", description = "Persiste o arquivo localmente e dispara o processamento assíncrono do job de importação")
    public ResponseEntity<ImportJobResponse> upload(@RequestParam("file") MultipartFile file) {
        ImportJob job = productImportService.createImportJob(file);
        productImportService.processImportAsync(job.getId());

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ImportJobResponse.fromEntity(job));
    }

    @GetMapping("/{id}/status")
    @Operation(summary = "Consulta por status do job", description = "Retorna o status atual e os contadores de processamento do job de importação")
    public ResponseEntity<ImportJobResponse> status(@PathVariable String id) {
        ImportJob job = productImportService.getImportStatus(id);
        return ResponseEntity.ok(ImportJobResponse.fromEntity(job));
    }

    @GetMapping
    @Operation(summary = "Listar jobs de importação", description = "Retorna os jobs de importação do tenant autenticado, mais recentes primeiro")
    public ResponseEntity<PageResponse<ImportJobResponse>> listJobs(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(PageResponse.fromPage(productImportService.getImportJobs(pageable).map(ImportJobResponse::fromEntity)));
    }

    @GetMapping("/{id}/errors")
    @Operation(summary = "Listar erros de um job", description = "Retorna as linhas rejeitadas de um job de importação, paginado")
    public ResponseEntity<PageResponse<ImportJobErrorResponse>> listErrors(
            @PathVariable String id,
            @PageableDefault(size = 10, sort = "rowNumber") Pageable pageable
    ) {
        return ResponseEntity.ok(PageResponse.fromPage(productImportService.getImportErrors(id, pageable).map(ImportJobErrorResponse::fromEntity)));
    }
}
