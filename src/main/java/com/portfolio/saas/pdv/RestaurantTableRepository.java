package com.portfolio.saas.pdv;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, String> {

    @Lock(LockModeType.OPTIMISTIC_FORCE_INCREMENT)
    @Query("SELECT rt FROM RestaurantTable rt LEFT JOIN FETCH rt.items WHERE rt.id = :id")
    Optional<RestaurantTable> findByIdWithItemsForVersionCheck(@Param("id") String id);

    Optional<RestaurantTable> findByTenantIdAndNumber(String tenantId, Integer number);
}
