package com.portfolio.saas.catalog;

import com.portfolio.saas.catalog.dto.ProductRequest;
import com.portfolio.saas.catalog.dto.ProductResponse;
import com.portfolio.saas.common.exception.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private CategoryService categoryService;

    @InjectMocks
    private ProductServiceImpl productService;

    @Test
    @DisplayName("Deve criar produto com categoria com sucesso")
    void shouldCreateProductSuccessfully() {
        Category category = new Category("Eletrônicos", "Smartphones");
        category.setId("cat-1");

        ProductRequest request = new ProductRequest(
                "SKU-001",
                "Smartphone X",
                new BigDecimal("1999.90"),
                50,
                "cat-1"
        );

        Product savedProduct = new Product(
                "SKU-001",
                "Smartphone X",
                new BigDecimal("1999.90"),
                50,
                category
        );
        savedProduct.setId("prod-1");
        savedProduct.setTenantId("tenant-1");

        when(productRepository.existsBySku("SKU-001")).thenReturn(false);
        when(categoryService.getCategoryEntityById("cat-1")).thenReturn(category);
        when(productRepository.save(any(Product.class))).thenReturn(savedProduct);

        ProductResponse response = productService.createProduct(request);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo("prod-1");
        assertThat(response.sku()).isEqualTo("SKU-001");
        assertThat(response.categoryId()).isEqualTo("cat-1");
        assertThat(response.categoryName()).isEqualTo("Eletrônicos");
        verify(productRepository).save(any(Product.class));
    }

    @Test
    @DisplayName("Deve lançar BusinessException ao tentar criar produto com SKU duplicado")
    void shouldThrowExceptionWhenSkuExists() {
        ProductRequest request = new ProductRequest(
                "SKU-001",
                "Smartphone X",
                new BigDecimal("1999.90"),
                50,
                null
        );

        when(productRepository.existsBySku("SKU-001")).thenReturn(true);

        assertThatThrownBy(() -> productService.createProduct(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Já existe um produto cadastrado com o SKU informado: SKU-001");

        verify(productRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve atualizar estoque corretamente")
    void shouldAdjustStockSuccessfully() {
        Product product = new Product("SKU-002", "Mouse Gamer", new BigDecimal("150.00"), 20, null);
        product.setId("prod-2");

        when(productRepository.adjustStockAtomic("prod-2", 15)).thenReturn(1);
        when(productRepository.findByIdScoped("prod-2")).thenReturn(Optional.of(product));

        // Ajuste de +15
        ProductResponse response = productService.updateStock("prod-2", 15);
        assertThat(response.stockQuantity()).isEqualTo(20);

        Product updatedProduct = new Product("SKU-002", "Mouse Gamer", new BigDecimal("150.00"), 10, null);
        updatedProduct.setId("prod-2");
        when(productRepository.adjustStockAtomic("prod-2", -10)).thenReturn(1);
        when(productRepository.findByIdScoped("prod-2")).thenReturn(Optional.of(updatedProduct));

        // Ajuste de -10
        response = productService.updateStock("prod-2", -10);
        assertThat(response.stockQuantity()).isEqualTo(10);
    }

    @Test
    @DisplayName("Deve lançar BusinessException se o ajuste de estoque resultar em valor negativo")
    void shouldThrowExceptionWhenStockBecomesNegative() {
        Product product = new Product("SKU-003", "Teclado", new BigDecimal("200.00"), 5, null);
        product.setId("prod-3");

        when(productRepository.findByIdScoped("prod-3")).thenReturn(Optional.of(product));
        when(productRepository.adjustStockAtomic("prod-3", -10)).thenReturn(0);

        assertThatThrownBy(() -> productService.updateStock("prod-3", -10))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Estoque insuficiente para o produto 'Teclado'");

        verify(productRepository, never()).save(any());
    }
}
