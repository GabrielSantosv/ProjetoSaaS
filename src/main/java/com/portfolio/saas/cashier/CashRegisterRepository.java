package com.portfolio.saas.cashier;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CashRegisterRepository extends JpaRepository<CashRegister, String> {

    @Query("SELECT c FROM CashRegister c WHERE c.tenantId = :tenantId AND c.status = com.portfolio.saas.cashier.CashRegisterStatus.OPEN")
    Optional<CashRegister> findOpenByTenantId(@Param("tenantId") String tenantId);

    @Query("SELECT c FROM CashRegister c WHERE c.tenantId = :tenantId ORDER BY c.openedAt DESC")
    Page<CashRegister> findAllByTenantId(@Param("tenantId") String tenantId, Pageable pageable);
}
