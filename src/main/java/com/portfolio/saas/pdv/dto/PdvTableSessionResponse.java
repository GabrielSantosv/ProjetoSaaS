package com.portfolio.saas.pdv.dto;

import com.portfolio.saas.pdv.PdvTableStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record PdvTableSessionResponse(
        String id,
        Integer number,
        String tableNumber,
        String customerName,
        PdvTableStatus status,
        BigDecimal total,
        String orderId,
        LocalDateTime openedAt,
        List<PdvTableItemResponse> items
) {}
