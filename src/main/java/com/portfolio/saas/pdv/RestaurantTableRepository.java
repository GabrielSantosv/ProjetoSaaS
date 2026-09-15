package com.portfolio.saas.pdv;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, String> {

    @Lock(LockModeType.OPTIMISTIC_FORCE_INCREMENT)
    @Query("SELECT rt FROM RestaurantTable rt LEFT JOIN FETCH rt.items WHERE rt.id = :id")
    Optional<RestaurantTable> findByIdWithItemsForVersionCheck(@Param("id") String id);

    @Query("SELECT rt FROM RestaurantTable rt LEFT JOIN FETCH rt.items WHERE rt.id = :id")
    Optional<RestaurantTable> findByIdWithItems(@Param("id") String id);

    Optional<RestaurantTable> findByTenantIdAndNumber(String tenantId, Integer number);

    List<RestaurantTable> findByStatusOrderByNumberAsc(PdvTableStatus status);

    long countByStatus(PdvTableStatus status);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE RestaurantTable rt SET rt.total = :total WHERE rt.id = :id")
    void updateTotalAtomic(@Param("id") String id, @Param("total") BigDecimal total);
}
