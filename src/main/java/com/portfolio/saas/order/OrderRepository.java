package com.portfolio.saas.order;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, String> {

    interface StatusCount {
        OrderStatus getStatus();
        Long getCount();
    }

    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.items i LEFT JOIN FETCH i.product WHERE o.id = :id")
    Optional<Order> findByIdScoped(@Param("id") String id);

    @Query("SELECT o FROM Order o WHERE " +
            "(:status IS NULL OR o.status = :status) AND " +
            "(:channel IS NULL OR o.channel = :channel) AND " +
            "(:search IS NULL OR LOWER(o.id) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(o.customerId) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Order> findFiltered(
            @Param("status") OrderStatus status,
            @Param("channel") OrderChannel channel,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("SELECT o.status as status, COUNT(o) as count FROM Order o WHERE " +
            "(:channel IS NULL OR o.channel = :channel) AND " +
            "(:search IS NULL OR LOWER(o.id) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(o.customerId) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "GROUP BY o.status")
    List<StatusCount> countByStatusFiltered(@Param("channel") OrderChannel channel, @Param("search") String search);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.items i LEFT JOIN FETCH i.product WHERE o.id = :id")
    Optional<Order> findByIdForUpdate(@Param("id") String id);

    Page<Order> findByChannel(OrderChannel channel, Pageable pageable);

    Page<Order> findByStatus(OrderStatus status, Pageable pageable);

    Page<Order> findByChannelAndStatus(OrderChannel channel, OrderStatus status, Pageable pageable);

    Page<Order> findByCustomerId(String customerId, Pageable pageable);
}
