package com.portfolio.saas.order.dto;

import com.portfolio.saas.common.dto.PageResponse;

import java.util.Map;

public record OrderListResponse(
        PageResponse<OrderResponse> page,
        Map<String, Long> counts
) {}
