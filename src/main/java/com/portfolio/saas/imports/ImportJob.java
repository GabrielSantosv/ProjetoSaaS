package com.portfolio.saas.imports;

import com.portfolio.saas.common.audit.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "import_jobs")
public class ImportJob extends BaseEntity {

    @Column(name = "file_name", length = 255, nullable = false)
    private String fileName;

    @Column(name = "stored_path", length = 500, nullable = false)
    private String storedPath;

    @Column(name = "status", nullable = false)
    @Enumerated(EnumType.STRING)
    private ImportJobStatus status = ImportJobStatus.PENDING;

    @Column(name = "total_rows", nullable = false)
    private Long totalRows = 0L;

    @Column(name = "processed_rows", nullable = false)
    private Long processedRows = 0L;

    @Column(name = "success_count", nullable = false)
    private Long successCount = 0L;

    @Column(name = "error_count", nullable = false)
    private Long errorCount = 0L;

    @Column(name = "message", length = 1000)
    private String message;

    public ImportJob() {
        super();
    }

    public ImportJob(String fileName, String storedPath) {
        this.fileName = fileName;
        this.storedPath = storedPath;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getStoredPath() {
        return storedPath;
    }

    public void setStoredPath(String storedPath) {
        this.storedPath = storedPath;
    }

    public ImportJobStatus getStatus() {
        return status;
    }

    public void setStatus(ImportJobStatus status) {
        this.status = status;
    }

    public Long getTotalRows() {
        return totalRows;
    }

    public void setTotalRows(Long totalRows) {
        this.totalRows = totalRows;
    }

    public Long getProcessedRows() {
        return processedRows;
    }

    public void setProcessedRows(Long processedRows) {
        this.processedRows = processedRows;
    }

    public Long getSuccessCount() {
        return successCount;
    }

    public void setSuccessCount(Long successCount) {
        this.successCount = successCount;
    }

    public Long getErrorCount() {
        return errorCount;
    }

    public void setErrorCount(Long errorCount) {
        this.errorCount = errorCount;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
