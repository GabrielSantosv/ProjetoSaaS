package com.portfolio.saas.catalog;

import com.portfolio.saas.catalog.dto.ProductRequest;
import com.portfolio.saas.catalog.dto.ProductResponse;
import com.portfolio.saas.catalog.dto.StockAdjustmentRequest;
import com.portfolio.saas.common.dto.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/products")
@Tag(name = "Catálogo - Produtos", description = "Gerenciamento de produtos do catálogo do tenant")
@SecurityRequirement(name = "bearerAuth")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @PostMapping
    @Operation(summary = "Criar Produto", description = "Cadastra um novo produto no catálogo do tenant autenticado")
    public ResponseEntity<ProductResponse> createProduct(@Valid @RequestBody ProductRequest request) {
        ProductResponse response = productService.createProduct(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @Operation(summary = "Listar Produtos Paginados", description = "Retorna produtos com suporte a paginação, busca textual por nome/SKU e filtro por categoria")
    public ResponseEntity<PageResponse<ProductResponse>> getProducts(
            @Parameter(description = "ID da categoria para filtro") @RequestParam(required = false) String categoryId,
            @Parameter(description = "Termo de busca por nome ou SKU") @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "name", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        return ResponseEntity.ok(productService.getProducts(categoryId, search, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Buscar Produto por ID", description = "Retorna os detalhes de um produto específico")
    public ResponseEntity<ProductResponse> getProductById(@PathVariable String id) {
        return ResponseEntity.ok(productService.getProductById(id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Atualizar Produto", description = "Atualiza os dados de um produto existente")
    public ResponseEntity<ProductResponse> updateProduct(
            @PathVariable String id,
            @Valid @RequestBody ProductRequest request
    ) {
        return ResponseEntity.ok(productService.updateProduct(id, request));
    }

    @PatchMapping("/{id}/stock")
    @Operation(summary = "Ajustar Estoque", description = "Incrementa ou decrementa a quantidade em estoque de um produto (ex: +10 ou -5)")
    public ResponseEntity<ProductResponse> adjustStock(
            @PathVariable String id,
            @Valid @RequestBody StockAdjustmentRequest request
    ) {
        return ResponseEntity.ok(productService.updateStock(id, request.deltaQuantity()));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Excluir Produto", description = "Remove um produto do catálogo do tenant")
    public ResponseEntity<Void> deleteProduct(@PathVariable String id) {
        productService.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }
}
