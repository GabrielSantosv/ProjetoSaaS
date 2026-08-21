package com.portfolio.saas.catalog;

import com.portfolio.saas.catalog.dto.CategoryRequest;
import com.portfolio.saas.catalog.dto.CategoryResponse;
import com.portfolio.saas.common.dto.PageResponse;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface CategoryService {

    CategoryResponse createCategory(CategoryRequest request);

    List<CategoryResponse> getAllCategories();

    PageResponse<CategoryResponse> getCategories(Pageable pageable);

    CategoryResponse getCategoryById(String id);

    Category getCategoryEntityById(String id);

    CategoryResponse updateCategory(String id, CategoryRequest request);

    void deleteCategory(String id);
}
