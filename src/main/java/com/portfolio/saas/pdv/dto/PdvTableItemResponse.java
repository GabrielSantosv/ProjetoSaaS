package com.portfolio.saas.pdv.dto;

import java.math.BigDecimal;

public record PdvTableItemResponse(
        String productId,
        String productName,
        Integer quantity,
        BigDecimal unitPrice,
        BigDecimal subtotal
) {}
