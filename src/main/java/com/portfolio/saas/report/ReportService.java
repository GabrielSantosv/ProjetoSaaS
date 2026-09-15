package com.portfolio.saas.report;

import com.portfolio.saas.report.dto.DashboardReportResponse;

public interface ReportService {
    DashboardReportResponse getDashboard(ReportPeriod period);
}
