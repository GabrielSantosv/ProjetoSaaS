package com.portfolio.saas.catalog;

import com.portfolio.saas.catalog.dto.CategoryRequest;
import com.portfolio.saas.catalog.dto.CategoryResponse;
import com.portfolio.saas.common.dto.PageResponse;
import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.common.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CategoryServiceImpl implements CategoryService {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    public CategoryServiceImpl(CategoryRepository categoryRepository, ProductRepository productRepository) {
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
    }

    @Override
    @Transactional
    public CategoryResponse createCategory(CategoryRequest request) {
        if (categoryRepository.existsByName(request.name())) {
            throw new BusinessException("Já existe uma categoria cadastrada com o nome: " + request.name());
        }

        Category category = new Category(request.name(), request.description());
        category = categoryRepository.save(category);

        return CategoryResponse.fromEntity(category);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoryResponse> getAllCategories() {
        return categoryRepository.findAll().stream()
                .map(CategoryResponse::fromEntity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CategoryResponse> getCategories(Pageable pageable) {
        Page<CategoryResponse> page = categoryRepository.findAll(pageable)
                .map(CategoryResponse::fromEntity);
        return PageResponse.fromPage(page);
    }

    @Override
    @Transactional(readOnly = true)
    public CategoryResponse getCategoryById(String id) {
        Category category = getCategoryEntityById(id);
        return CategoryResponse.fromEntity(category);
    }

    @Override
    @Transactional(readOnly = true)
    public Category getCategoryEntityById(String id) {
        return categoryRepository.findByIdScoped(id)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria não encontrada com o ID: " + id));
    }

    @Override
    @Transactional
    public CategoryResponse updateCategory(String id, CategoryRequest request) {
        Category category = getCategoryEntityById(id);

        if (!category.getName().equalsIgnoreCase(request.name()) && categoryRepository.existsByName(request.name())) {
            throw new BusinessException("Já existe uma categoria cadastrada com o nome: " + request.name());
        }

        category.setName(request.name());
        category.setDescription(request.description());
        category = categoryRepository.save(category);

        return CategoryResponse.fromEntity(category);
    }

    @Override
    @Transactional
    public void deleteCategory(String id) {
        Category category = getCategoryEntityById(id);

        if (productRepository.existsByCategoryId(id)) {
            throw new BusinessException("Não é possível excluir uma categoria que possui produtos vinculados.");
        }

        categoryRepository.delete(category);
    }
}
