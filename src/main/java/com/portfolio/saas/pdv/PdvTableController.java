package com.portfolio.saas.pdv;

import com.portfolio.saas.pdv.dto.AddTableItemRequest;
import com.portfolio.saas.pdv.dto.OpenTableRequest;
import com.portfolio.saas.pdv.dto.PdvTableSessionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/pdv")
@Tag(name = "PDV - Mesas", description = "Abertura, itens e fechamento de mesas no PDV")
@SecurityRequirement(name = "bearerAuth")
public class PdvTableController {

    private final PdvTableService pdvTableService;

    public PdvTableController(PdvTableService pdvTableService) {
        this.pdvTableService = pdvTableService;
    }

    @GetMapping("/tables")
    @PreAuthorize("hasAnyRole('ADMIN','SELLER','USER')")
    @Operation(summary = "Listar mesas abertas", description = "Retorna as comandas atualmente abertas no PDV")
    public ResponseEntity<List<PdvTableSessionResponse>> listOpenTables() {
        return ResponseEntity.ok(pdvTableService.listOpenTables());
    }

    @PostMapping("/tables")
    @PreAuthorize("hasAnyRole('ADMIN','SELLER','USER')")
    @Operation(summary = "Abrir mesa", description = "Abre uma nova comanda para atendimento no PDV")
    public ResponseEntity<PdvTableSessionResponse> openTable(@Valid @RequestBody OpenTableRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(pdvTableService.openTable(request));
    }

    @PostMapping("/tables/{tableId}/items")
    @PreAuthorize("hasAnyRole('ADMIN','SELLER','USER')")
    @Operation(summary = "Adicionar item à mesa", description = "Adiciona um item ao consumo da mesa e recalcula o total")
    public ResponseEntity<PdvTableSessionResponse> addItem(@PathVariable String tableId, @Valid @RequestBody AddTableItemRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(pdvTableService.addItem(tableId, request));
    }

    @PostMapping("/tables/{tableId}/close")
    @PreAuthorize("hasAnyRole('ADMIN','SELLER','USER')")
    @Operation(summary = "Fechar mesa", description = "Fecha a mesa e transforma a comanda em pedido do canal PDV")
    public ResponseEntity<PdvTableSessionResponse> closeTable(@PathVariable String tableId) {
        return ResponseEntity.ok(pdvTableService.closeTable(tableId));
    }
}
