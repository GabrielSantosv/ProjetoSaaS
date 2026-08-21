package com.portfolio.saas.imports;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ImportJobErrorRepository extends JpaRepository<ImportJobError, String> {
}
