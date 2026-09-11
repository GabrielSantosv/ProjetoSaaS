package com.portfolio.saas.catalog;

import com.portfolio.saas.catalog.dto.ProductListResponse;
import com.portfolio.saas.catalog.dto.ProductRequest;
import com.portfolio.saas.catalog.dto.ProductResponse;
import com.portfolio.saas.common.dto.PageResponse;
import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.common.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final CategoryService categoryService;

    public ProductServiceImpl(ProductRepository productRepository, CategoryService categoryService) {
        this.productRepository = productRepository;
        this.categoryService = categoryService;
    }

    @Override
    @Transactional
    public ProductResponse createProduct(ProductRequest request) {
        if (productRepository.existsBySku(request.sku())) {
            throw new BusinessException("Já existe um produto cadastrado com o SKU informado: " + request.sku());
        }

        Category category = null;
        if (request.categoryId() != null && !request.categoryId().isBlank()) {
            category = categoryService.getCategoryEntityById(request.categoryId());
        }

        Product product = new Product(
                request.sku(),
                request.name(),
                request.price(),
                request.stockQuantity(),
                category
        );
        product.setCost(request.cost());
        product.setStatus(request.status());
        product.setDescription(request.description());

        product = productRepository.save(product);
        return ProductResponse.fromEntity(product);
    }

    @Override
    @Transactional(readOnly = true)
    public ProductListResponse getProducts(String categoryId, String search, String status, Pageable pageable) {
        boolean hasCategory = categoryId != null && !categoryId.isBlank();
        boolean hasSearch = search != null && !search.isBlank();
        ProductStatus statusFilter = (status == null || status.isBlank()) ? null : ProductStatus.valueOf(status);

        Page<Product> productPage = productRepository.findFiltered(
                hasCategory ? categoryId : null,
                hasSearch ? search.trim() : null,
                statusFilter,
                pageable
        );

        PageResponse<ProductResponse> page = PageResponse.fromPage(productPage.map(ProductResponse::fromEntity));

        // Contagens agregadas no banco, respeitando o mesmo filtro de busca/categoria da
        // página atual — nunca inferir "total por status" a partir de uma página parcial.
        Map<String, Long> counts = new LinkedHashMap<>();
        for (ProductStatus s : ProductStatus.values()) {
            counts.put(s.name(), 0L);
        }
        long total = 0L;
        for (ProductRepository.StatusCount statusCount : productRepository.countByStatusFiltered(
                hasCategory ? categoryId : null,
                hasSearch ? search.trim() : null)) {
            counts.put(statusCount.getStatus().name(), statusCount.getCount());
            total += statusCount.getCount();
        }
        counts.put("TOTAL", total);

        return new ProductListResponse(page, counts);
    }

    @Override
    @Transactional(readOnly = true)
    public ProductResponse getProductById(String id) {
        Product product = getProductEntityById(id);
        return ProductResponse.fromEntity(product);
    }

    @Override
    @Transactional(readOnly = true)
    public Product getProductEntityById(String id) {
        return productRepository.findByIdScoped(id)
                .orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado com o ID: " + id));
    }

    @Override
    @Transactional
    public ProductResponse updateProduct(String id, ProductRequest request) {
        Product product = getProductEntityById(id);

        if (!product.getSku().equalsIgnoreCase(request.sku()) && productRepository.existsBySku(request.sku())) {
            throw new BusinessException("Já existe um produto cadastrado com o SKU informado: " + request.sku());
        }

        Category category = null;
        if (request.categoryId() != null && !request.categoryId().isBlank()) {
            category = categoryService.getCategoryEntityById(request.categoryId());
        }

        // stockQuantity é ignorado aqui de propósito: ajuste de estoque passa sempre por
        // updateStock()/adjustStockAtomic, que é atômico. Aplicar aqui reabriria a race
        // condition de lost update que esse endpoint atômico foi criado para eliminar.
        product.setSku(request.sku());
        product.setName(request.name());
        product.setPrice(request.price());
        product.setCategory(category);
        product.setCost(request.cost());
        product.setStatus(request.status());
        product.setDescription(request.description());

        product = productRepository.save(product);
        return ProductResponse.fromEntity(product);
    }

    @Override
    @Transactional
    public ProductResponse updateStock(String id, int delta) {
        Product product = getProductEntityById(id);

        int updatedRows = productRepository.adjustStockAtomic(id, delta);
        if (updatedRows == 0) {
            throw new BusinessException(String.format(
                    "Estoque insuficiente para o produto '%s'. Estoque atual: %d, ajuste solicitado: %d",
                    product.getName(), product.getStockQuantity(), delta
            ));
        }

        product = productRepository.findByIdScoped(id)
                .orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado com o ID: " + id));
        return ProductResponse.fromEntity(product);
    }

    @Override
    @Transactional
    public void deleteProduct(String id) {
        Product product = getProductEntityById(id);
        productRepository.delete(product);
    }
}
