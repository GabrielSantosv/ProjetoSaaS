package com.portfolio.saas.pdv;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RestaurantTableItemRepository extends JpaRepository<RestaurantTableItem, String> {
}
