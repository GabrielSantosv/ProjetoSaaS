package com.portfolio.saas.catalog;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, String> {

    interface StatusCount {
        ProductStatus getStatus();
        Long getCount();
    }

    @Query("SELECT p.status as status, COUNT(p) as count FROM Product p " +
            "WHERE (:categoryId IS NULL OR p.category.id = :categoryId) " +
            "AND (:search IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(p.sku) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "GROUP BY p.status")
    List<StatusCount> countByStatusFiltered(@Param("categoryId") String categoryId, @Param("search") String search);

    @Query("SELECT p FROM Product p WHERE p.id = :id")
    Optional<Product> findByIdScoped(@Param("id") String id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Product p SET p.stockQuantity = p.stockQuantity + :delta " +
            "WHERE p.id = :id AND p.stockQuantity + :delta >= 0")
    int adjustStockAtomic(@Param("id") String id, @Param("delta") int delta);

    boolean existsBySku(String sku);

    Optional<Product> findBySku(String sku);

    boolean existsByCategoryId(String categoryId);

    @Query("SELECT p FROM Product p WHERE " +
            "(:categoryId IS NULL OR p.category.id = :categoryId) AND " +
            "(:search IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(p.sku) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
            "(:status IS NULL OR p.status = :status)")
    Page<Product> findFiltered(
            @Param("categoryId") String categoryId,
            @Param("search") String search,
            @Param("status") ProductStatus status,
            Pageable pageable
    );
}
