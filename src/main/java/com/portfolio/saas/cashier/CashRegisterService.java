package com.portfolio.saas.cashier;

import com.portfolio.saas.cashier.dto.CloseCashRegisterRequest;
import com.portfolio.saas.cashier.dto.CashRegisterResponse;
import com.portfolio.saas.common.dto.PageResponse;
import org.springframework.data.domain.Pageable;

public interface CashRegisterService {
    CashRegisterResponse openRegister();
    CashRegisterResponse closeRegister(String id, CloseCashRegisterRequest request);
    CashRegisterResponse getOpenRegister();
    PageResponse<CashRegisterResponse> listRegisters(Pageable pageable);
}
