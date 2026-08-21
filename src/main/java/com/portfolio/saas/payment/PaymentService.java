package com.portfolio.saas.payment;

import com.portfolio.saas.payment.dto.PaymentRequest;
import com.portfolio.saas.payment.dto.PaymentResponse;

import java.util.List;

public interface PaymentService {
    PaymentResponse createPayment(PaymentRequest request);
    List<PaymentResponse> getPayments();
}
