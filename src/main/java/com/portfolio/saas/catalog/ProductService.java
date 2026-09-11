package com.portfolio.saas.catalog;

import com.portfolio.saas.catalog.dto.ProductListResponse;
import com.portfolio.saas.catalog.dto.ProductRequest;
import com.portfolio.saas.catalog.dto.ProductResponse;
import org.springframework.data.domain.Pageable;

public interface ProductService {

    ProductResponse createProduct(ProductRequest request);

    ProductListResponse getProducts(String categoryId, String search, String status, Pageable pageable);

    ProductResponse getProductById(String id);

    Product getProductEntityById(String id);

    ProductResponse updateProduct(String id, ProductRequest request);

    ProductResponse updateStock(String id, int delta);

    void deleteProduct(String id);
}
