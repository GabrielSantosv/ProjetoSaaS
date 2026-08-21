package com.portfolio.saas.catalog;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CategoryRepository extends JpaRepository<Category, String> {

    @Query("SELECT c FROM Category c WHERE c.id = :id")
    Optional<Category> findByIdScoped(@Param("id") String id);

    boolean existsByName(String name);

    Optional<Category> findByName(String name);

    Page<Category> findAll(Pageable pageable);
}
