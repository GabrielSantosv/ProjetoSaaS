package com.portfolio.saas.imports;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImportJobErrorRepository extends JpaRepository<ImportJobError, String> {

    Page<ImportJobError> findByJob_Id(String jobId, Pageable pageable);
}
