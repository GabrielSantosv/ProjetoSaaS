package com.portfolio.saas.pdv.dto;

import com.portfolio.saas.pdv.PdvTableStatus;

import java.math.BigDecimal;

public record PdvTableSessionResponse(
        String id,
        String tableNumber,
        String customerName,
        PdvTableStatus status,
        BigDecimal total,
        String orderId
) {}
