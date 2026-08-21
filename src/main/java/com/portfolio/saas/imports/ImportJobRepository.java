package com.portfolio.saas.imports;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ImportJobRepository extends JpaRepository<ImportJob, String> {

    @Modifying
    @Query("UPDATE ImportJob job SET job.processedRows = :processedRows, job.successCount = :successCount, job.errorCount = :errorCount, job.status = :status WHERE job.id = :jobId")
    int updateCounters(@Param("jobId") String jobId,
                       @Param("processedRows") Long processedRows,
                       @Param("successCount") Long successCount,
                       @Param("errorCount") Long errorCount,
                       @Param("status") ImportJobStatus status);

    @Modifying
    @Query("UPDATE ImportJob job SET job.processedRows = job.processedRows + :processedDelta, job.successCount = job.successCount + :successDelta, job.errorCount = job.errorCount + :errorDelta WHERE job.id = :jobId")
    int incrementProgress(@Param("jobId") String jobId,
                          @Param("processedDelta") long processedDelta,
                          @Param("successDelta") long successDelta,
                          @Param("errorDelta") long errorDelta);

    @Modifying
    @Query("UPDATE ImportJob job SET job.status = :status, job.message = :message WHERE job.id = :jobId")
    int markStatus(@Param("jobId") String jobId, @Param("status") ImportJobStatus status, @Param("message") String message);
}
