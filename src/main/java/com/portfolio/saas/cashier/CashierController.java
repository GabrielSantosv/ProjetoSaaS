package com.portfolio.saas.cashier;

import com.portfolio.saas.cashier.dto.CashRegisterResponse;
import com.portfolio.saas.cashier.dto.CloseCashRegisterRequest;
import com.portfolio.saas.common.dto.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/cashier")
@Tag(name = "Caixa", description = "Abertura e fechamento do caixa")
@SecurityRequirement(name = "bearerAuth")
public class CashierController {

    private final CashRegisterService cashRegisterService;

    public CashierController(CashRegisterService cashRegisterService) {
        this.cashRegisterService = cashRegisterService;
    }

    @PostMapping("/registers/open")
    @PreAuthorize("hasAnyRole('ADMIN','CASHIER')")
    @Operation(summary = "Abrir caixa", description = "Abre um novo caixa para o tenant autenticado")
    public ResponseEntity<CashRegisterResponse> openRegister() {
        return ResponseEntity.status(HttpStatus.CREATED).body(cashRegisterService.openRegister());
    }

    @GetMapping("/registers/open")
    @PreAuthorize("hasAnyRole('ADMIN','CASHIER')")
    @Operation(summary = "Consultar caixa aberto", description = "Retorna o caixa ativo do tenant autenticado")
    public ResponseEntity<CashRegisterResponse> getOpenRegister() {
        return ResponseEntity.ok(cashRegisterService.getOpenRegister());
    }

    @PostMapping("/registers/{id}/close")
    @PreAuthorize("hasAnyRole('ADMIN','CASHIER')")
    @Operation(summary = "Fechar caixa", description = "Finaliza o caixa com os valores recebidos em dinheiro e cartão")
    public ResponseEntity<CashRegisterResponse> closeRegister(
            @PathVariable String id,
            @Valid @RequestBody CloseCashRegisterRequest request
    ) {
        return ResponseEntity.ok(cashRegisterService.closeRegister(id, request));
    }

    @GetMapping("/registers")
    @PreAuthorize("hasAnyRole('ADMIN','CASHIER')")
    @Operation(summary = "Histórico de caixas", description = "Lista paginada dos caixas do tenant autenticado, do mais recente para o mais antigo")
    public ResponseEntity<PageResponse<CashRegisterResponse>> listRegisters(
            @PageableDefault(size = 20, sort = "openedAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(cashRegisterService.listRegisters(pageable));
    }
}
