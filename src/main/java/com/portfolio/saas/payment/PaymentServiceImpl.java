package com.portfolio.saas.payment;

import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.common.exception.ResourceNotFoundException;
import com.portfolio.saas.order.Order;
import com.portfolio.saas.order.OrderRepository;
import com.portfolio.saas.order.OrderStatus;
import com.portfolio.saas.payment.dto.PaymentRequest;
import com.portfolio.saas.payment.dto.PaymentResponse;
import com.portfolio.saas.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class PaymentServiceImpl implements PaymentService {

    private final PaymentRepository paymentRepository;
    private final OrderRepository orderRepository;

    public PaymentServiceImpl(PaymentRepository paymentRepository, OrderRepository orderRepository) {
        this.paymentRepository = paymentRepository;
        this.orderRepository = orderRepository;
    }

    @Override
    @Transactional
    public PaymentResponse createPayment(PaymentRequest request) {
        if (request == null) {
            throw new BusinessException("Dados do pagamento são obrigatórios.");
        }

        Order order = orderRepository.findByIdForUpdate(request.orderId())
                .orElseThrow(() -> new ResourceNotFoundException("Pedido não encontrado com o ID: " + request.orderId()));

        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("O valor do pagamento deve ser maior que zero.");
        }

        if (request.method() == null) {
            throw new BusinessException("O método de pagamento é obrigatório.");
        }

        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new BusinessException("Não é possível pagar um pedido cancelado.");
        }

        BigDecimal totalPaid = paymentRepository.sumByOrderId(order.getId());
        BigDecimal remaining = order.getTotal().subtract(totalPaid);

        if (order.getStatus() == OrderStatus.COMPLETED || totalPaid.compareTo(order.getTotal()) >= 0) {
            throw new BusinessException("Este pedido já foi pago na íntegra.");
        }

        if (request.amount().compareTo(remaining) > 0) {
            throw new BusinessException("O valor do pagamento excede o total restante do pedido.");
        }

        Payment payment = new Payment(order, request.method(), request.amount());
        payment.setTenantId(TenantContext.getTenantId());
        payment = paymentRepository.save(payment);

        BigDecimal updatedTotalPaid = totalPaid.add(request.amount());
        if (updatedTotalPaid.compareTo(order.getTotal()) == 0) {
            order.setStatus(OrderStatus.COMPLETED);
            orderRepository.save(order);
        }

        return PaymentResponse.fromEntity(payment);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentResponse> getPayments() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException("Tenant ativo obrigatório para consultar pagamentos.");
        }

        return paymentRepository.findAllByTenantId(tenantId).stream()
                .map(PaymentResponse::fromEntity)
                .toList();
    }
}
