package com.portfolio.saas.catalog;

import com.portfolio.saas.catalog.dto.ProductRequest;
import com.portfolio.saas.catalog.dto.ProductResponse;
import com.portfolio.saas.common.dto.PageResponse;
import org.springframework.data.domain.Pageable;

public interface ProductService {

    ProductResponse createProduct(ProductRequest request);

    PageResponse<ProductResponse> getProducts(String categoryId, String search, Pageable pageable);

    ProductResponse getProductById(String id);

    Product getProductEntityById(String id);

    ProductResponse updateProduct(String id, ProductRequest request);

    ProductResponse updateStock(String id, int delta);

    void deleteProduct(String id);
}
