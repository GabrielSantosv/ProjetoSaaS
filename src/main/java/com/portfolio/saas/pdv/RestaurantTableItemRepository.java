package com.portfolio.saas.pdv;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;

@Repository
public interface RestaurantTableItemRepository extends JpaRepository<RestaurantTableItem, String> {

    // Upsert atômico: se já existe uma linha para (restaurant_table_id, product_id) — protegido
    // pela constraint única uq_table_item_product — soma a quantidade em vez de criar outra linha.
    // Evita tanto o OptimisticLockException de duas escritas concorrentes na mesma linha quanto a
    // condição de corrida de "duas linhas criadas para o mesmo produto" quando o item ainda não existe.
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "INSERT INTO restaurant_table_items " +
            "(id, tenant_id, restaurant_table_id, product_id, product_name, quantity, unit_price) " +
            "VALUES (:id, :tenantId, :tableId, :productId, :productName, :quantity, :unitPrice) " +
            "ON DUPLICATE KEY UPDATE quantity = quantity + :quantity",
            nativeQuery = true)
    void upsertItem(@Param("id") String id,
                     @Param("tenantId") String tenantId,
                     @Param("tableId") String tableId,
                     @Param("productId") String productId,
                     @Param("productName") String productName,
                     @Param("quantity") int quantity,
                     @Param("unitPrice") BigDecimal unitPrice);
}
