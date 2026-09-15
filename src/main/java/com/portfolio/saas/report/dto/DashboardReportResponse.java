package com.portfolio.saas.report.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record DashboardReportResponse(
        BigDecimal faturamento,
        long pedidos,
        BigDecimal ticketMedio,
        long novosClientes,
        RevenueByChannel receitaPorCanal,
        List<DailyRevenue> faturamentoPorDia,
        OperationalSummary operacional
) {
    /**
     * Só e-commerce e PDV — os dois canais reais que geram pagamentos hoje.
     * O frontend soma uma terceira fatia "Importação" fixa em zero por conta
     * própria; a importação nunca gerou receita, então não existe (e não deve
     * existir) uma chamada de backend para essa fatia.
     */
    public record RevenueByChannel(BigDecimal ecommerce, BigDecimal pdv) {}

    public record DailyRevenue(LocalDate date, BigDecimal total) {}

    /**
     * Dados em tempo real (não filtrados pelo período do dashboard, sempre "hoje"
     * / "agora"), usados pelos três mini-cards da tela.
     */
    public record OperationalSummary(
            long produtosAtivos,
            long produtosSemEstoque,
            long produtosRascunho,
            long arquivosImportadosHoje,
            long linhasImportadasHoje,
            long linhasComErroHoje,
            long mesasOcupadas
    ) {}
}
