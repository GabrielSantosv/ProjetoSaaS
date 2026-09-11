package com.portfolio.saas.catalog.dto;

import com.portfolio.saas.common.dto.PageResponse;

import java.util.Map;

public record ProductListResponse(
        PageResponse<ProductResponse> page,
        Map<String, Long> counts
) {}
