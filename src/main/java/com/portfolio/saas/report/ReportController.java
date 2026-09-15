package com.portfolio.saas.report;

import com.portfolio.saas.report.dto.DashboardReportResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reports")
@Tag(name = "Relatórios", description = "Agregações do ReportService para o dashboard administrativo")
@SecurityRequirement(name = "bearerAuth")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('ADMIN','SELLER','CASHIER')")
    @Operation(summary = "Dashboard administrativo", description = "Agregações de faturamento, pedidos e operação para o período informado")
    public ResponseEntity<DashboardReportResponse> getDashboard(
            @Parameter(description = "Período do relatório: TODAY, LAST_7_DAYS ou LAST_30_DAYS") @RequestParam ReportPeriod period
    ) {
        return ResponseEntity.ok(reportService.getDashboard(period));
    }
}
