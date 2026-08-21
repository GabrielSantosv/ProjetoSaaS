package com.portfolio.saas.catalog;

import com.portfolio.saas.catalog.dto.ProductRequest;
import com.portfolio.saas.catalog.dto.ProductResponse;
import com.portfolio.saas.common.dto.PageResponse;
import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.common.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

        product = productRepository.save(product);
        return ProductResponse.fromEntity(product);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> getProducts(String categoryId, String search, Pageable pageable) {
        Page<Product> productPage;

        boolean hasCategory = categoryId != null && !categoryId.isBlank();
        boolean hasSearch = search != null && !search.isBlank();

        if (hasCategory && hasSearch) {
            productPage = productRepository.searchProductsWithCategory(categoryId, search.trim(), pageable);
        } else if (hasCategory) {
            productPage = productRepository.findByCategoryId(categoryId, pageable);
        } else if (hasSearch) {
            productPage = productRepository.searchProducts(search.trim(), pageable);
        } else {
            productPage = productRepository.findAll(pageable);
        }

        return PageResponse.fromPage(productPage.map(ProductResponse::fromEntity));
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

        product.setSku(request.sku());
        product.setName(request.name());
        product.setPrice(request.price());
        product.setStockQuantity(request.stockQuantity());
        product.setCategory(category);

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
