package com.portfolio.saas.catalog;

import com.portfolio.saas.catalog.dto.CategoryRequest;
import com.portfolio.saas.catalog.dto.CategoryResponse;
import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.common.exception.ResourceNotFoundException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CategoryServiceTest {

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private ProductRepository productRepository;

    @InjectMocks
    private CategoryServiceImpl categoryService;

    @Test
    @DisplayName("Deve criar categoria com sucesso")
    void shouldCreateCategorySuccessfully() {
        CategoryRequest request = new CategoryRequest("Bebidas", "Refrigerantes e sucos");
        Category savedCategory = new Category("Bebidas", "Refrigerantes e sucos");
        savedCategory.setId("cat-1");
        savedCategory.setTenantId("tenant-1");

        when(categoryRepository.existsByName("Bebidas")).thenReturn(false);
        when(categoryRepository.save(any(Category.class))).thenReturn(savedCategory);

        CategoryResponse response = categoryService.createCategory(request);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo("cat-1");
        assertThat(response.name()).isEqualTo("Bebidas");
        verify(categoryRepository).save(any(Category.class));
    }

    @Test
    @DisplayName("Deve lançar BusinessException ao tentar criar categoria com nome duplicado")
    void shouldThrowExceptionWhenCategoryNameExists() {
        CategoryRequest request = new CategoryRequest("Bebidas", "Refrigerantes e sucos");

        when(categoryRepository.existsByName("Bebidas")).thenReturn(true);

        assertThatThrownBy(() -> categoryService.createCategory(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Já existe uma categoria cadastrada com o nome: Bebidas");

        verify(categoryRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve lançar ResourceNotFoundException ao buscar categoria inexistente")
    void shouldThrowExceptionWhenCategoryNotFound() {
        when(categoryRepository.findByIdScoped("cat-999")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> categoryService.getCategoryById("cat-999"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Categoria não encontrada com o ID: cat-999");
    }

    @Test
    @DisplayName("Deve impedir exclusão de categoria que possui produtos vinculados")
    void shouldPreventDeletingCategoryWithProducts() {
        Category category = new Category("Sobremesas", "Doces");
        category.setId("cat-2");

        when(categoryRepository.findByIdScoped("cat-2")).thenReturn(Optional.of(category));
        when(productRepository.existsByCategoryId("cat-2")).thenReturn(true);

        assertThatThrownBy(() -> categoryService.deleteCategory("cat-2"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Não é possível excluir uma categoria que possui produtos vinculados.");

        verify(categoryRepository, never()).delete(any());
    }
}
