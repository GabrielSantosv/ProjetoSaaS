package com.portfolio.saas.imports;

import com.portfolio.saas.common.audit.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "import_job_errors")
public class ImportJobError extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "import_job_id", nullable = false)
    private ImportJob job;

    @Column(name = "row_num", nullable = false)
    private Long rowNumber;

    @Column(name = "error_message", length = 500, nullable = false)
    private String errorMessage;

    public ImportJobError() {
        super();
    }

    public ImportJobError(ImportJob job, Long rowNumber, String errorMessage) {
        this.job = job;
        this.rowNumber = rowNumber;
        this.errorMessage = errorMessage;
    }

    public ImportJob getJob() {
        return job;
    }

    public void setJob(ImportJob job) {
        this.job = job;
    }

    public Long getRowNumber() {
        return rowNumber;
    }

    public void setRowNumber(Long rowNumber) {
        this.rowNumber = rowNumber;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }
}
