package com.portfolio.saas.catalog;

import com.portfolio.saas.catalog.dto.ProductResponse;
import com.portfolio.saas.catalog.dto.StorefrontProductResponse;
import com.portfolio.saas.common.dto.PageResponse;
import com.portfolio.saas.common.exception.ResourceNotFoundException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Catálogo público do storefront (sem autenticação). Reaproveita o ProductService por baixo,
 * mas NUNCA o ProductController autenticado — path e DTO são deliberadamente próprios, para não
 * abrir o catálogo de gestão (com custo, status de rascunho etc.) para visitantes anônimos.
 * Sempre força status=ACTIVE, ignorando qualquer outro filtro de status.
 */
@RestController
@RequestMapping("/api/v1/storefront/products")
@Tag(name = "Storefront - Catálogo", description = "Catálogo público do storefront, sem autenticação")
public class StorefrontCatalogController {

    private final ProductService productService;

    public StorefrontCatalogController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    @Operation(summary = "Listar produtos do storefront", description = "Retorna somente produtos ACTIVE, com paginação e busca")
    public ResponseEntity<PageResponse<StorefrontProductResponse>> getProducts(
            @Parameter(description = "ID da categoria para filtro") @RequestParam(required = false) String categoryId,
            @Parameter(description = "Termo de busca por nome ou SKU") @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "name", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        PageResponse<ProductResponse> page = productService.getProducts(categoryId, search, "ACTIVE", pageable).page();
        PageResponse<StorefrontProductResponse> publicPage = new PageResponse<>(
                page.content().stream().map(StorefrontProductResponse::fromEntity).toList(),
                page.pageNumber(),
                page.pageSize(),
                page.totalElements(),
                page.totalPages(),
                page.isLast()
        );
        return ResponseEntity.ok(publicPage);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Buscar produto do storefront por ID", description = "Retorna o produto somente se estiver ACTIVE")
    public ResponseEntity<StorefrontProductResponse> getProductById(@PathVariable String id) {
        ProductResponse product = productService.getProductById(id);
        if (product.status() != ProductStatus.ACTIVE) {
            throw new ResourceNotFoundException("Produto não encontrado com o ID: " + id);
        }
        return ResponseEntity.ok(StorefrontProductResponse.fromEntity(product));
    }
}
