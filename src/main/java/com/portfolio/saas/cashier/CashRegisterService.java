package com.portfolio.saas.cashier;

import com.portfolio.saas.cashier.dto.CloseCashRegisterRequest;
import com.portfolio.saas.cashier.dto.CashRegisterResponse;

public interface CashRegisterService {
    CashRegisterResponse openRegister();
    CashRegisterResponse closeRegister(String id, CloseCashRegisterRequest request);
    CashRegisterResponse getOpenRegister();
}
