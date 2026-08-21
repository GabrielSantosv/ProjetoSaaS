package com.portfolio.saas.imports;

public record ImportJobResponse(
        String id,
        String fileName,
        ImportJobStatus status,
        Long totalRows,
        Long processedRows,
        Long successCount,
        Long errorCount,
        String message
) {
    public static ImportJobResponse fromEntity(ImportJob job) {
        return new ImportJobResponse(
                job.getId(),
                job.getFileName(),
                job.getStatus(),
                job.getTotalRows(),
                job.getProcessedRows(),
                job.getSuccessCount(),
                job.getErrorCount(),
                job.getMessage()
        );
    }
}
