package com.portfolio.saas.cashier;

import com.portfolio.saas.cashier.dto.CashRegisterResponse;
import com.portfolio.saas.cashier.dto.CloseCashRegisterRequest;
import com.portfolio.saas.common.dto.PageResponse;
import com.portfolio.saas.common.exception.BusinessException;
import com.portfolio.saas.common.exception.ResourceNotFoundException;
import com.portfolio.saas.payment.PaymentMethod;
import com.portfolio.saas.payment.PaymentRepository;
import com.portfolio.saas.tenant.TenantContext;
import com.portfolio.saas.tenant.TenantRepository;
import jakarta.persistence.OptimisticLockException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class CashRegisterServiceImpl implements CashRegisterService {

    private final CashRegisterRepository cashRegisterRepository;
    private final TenantRepository tenantRepository;
    private final PaymentRepository paymentRepository;

    public CashRegisterServiceImpl(CashRegisterRepository cashRegisterRepository,
                                  TenantRepository tenantRepository,
                                  PaymentRepository paymentRepository) {
        this.cashRegisterRepository = cashRegisterRepository;
        this.tenantRepository = tenantRepository;
        this.paymentRepository = paymentRepository;
    }

    @Override
    @Transactional
    public CashRegisterResponse openRegister() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException("Tenant ativo obrigatório para abrir o caixa.");
        }

        tenantRepository.findByIdForUpdate(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant não encontrado para abertura do caixa: " + tenantId));

        Optional<CashRegister> openRegister = cashRegisterRepository.findOpenByTenantId(tenantId);
        if (openRegister.isPresent()) {
            throw new BusinessException("já existe um caixa aberto para este tenant.");
        }

        CashRegister register = new CashRegister(LocalDateTime.now());
        register.setTenantId(tenantId);
        register.setStatus(CashRegisterStatus.OPEN);
        register.setOpenMarker(tenantId);
        register.setOpenedAt(LocalDateTime.now());
        register.setTotalCash(BigDecimal.ZERO);
        register.setTotalCard(BigDecimal.ZERO);

        return CashRegisterResponse.fromEntity(cashRegisterRepository.save(register));
    }

    @Override
    @Transactional
    public CashRegisterResponse closeRegister(String id, CloseCashRegisterRequest request) {
        if (request == null) {
            throw new BusinessException("Dados do fechamento do caixa são obrigatórios.");
        }

        CashRegister register = cashRegisterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Caixa não encontrado com o ID: " + id));

        if (register.getStatus() == CashRegisterStatus.CLOSED) {
            throw new BusinessException("Este caixa já está fechado.");
        }

        BigDecimal totalCash = paymentRepository.sumByTenantIdAndMethodAndCreatedAtGreaterThanEqual(
                register.getTenantId(), PaymentMethod.CASH, register.getOpenedAt());
        BigDecimal totalCard = paymentRepository.sumByTenantIdAndMethodAndCreatedAtGreaterThanEqual(
                register.getTenantId(), PaymentMethod.CARD, register.getOpenedAt())
                .add(paymentRepository.sumByTenantIdAndMethodAndCreatedAtGreaterThanEqual(
                        register.getTenantId(), PaymentMethod.PIX, register.getOpenedAt()));

        BigDecimal expectedCash = totalCash == null ? BigDecimal.ZERO : totalCash;
        BigDecimal expectedCard = totalCard == null ? BigDecimal.ZERO : totalCard;

        BigDecimal cashDifference = request.cashDifference(expectedCash);
        BigDecimal cardDifference = request.cardDifference(expectedCard);

        register.setTotalCash(expectedCash.add(cashDifference));
        register.setTotalCard(expectedCard.add(cardDifference));
        register.setCashDifference(cashDifference);
        register.setCardDifference(cardDifference);
        register.setStatus(CashRegisterStatus.CLOSED);
        register.setOpenMarker(null);
        register.setClosedAt(LocalDateTime.now());

        try {
            CashRegister saved = cashRegisterRepository.saveAndFlush(register);
            return CashRegisterResponse.fromEntity(saved);
        } catch (OptimisticLockingFailureException | OptimisticLockException ex) {
            throw new BusinessException("Este caixa já foi fechado ou alterado por outro terminal. Atualize a tela e tente novamente.");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CashRegisterResponse> listRegisters(Pageable pageable) {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException("Tenant ativo obrigatório para consultar o histórico do caixa.");
        }

        return PageResponse.fromPage(cashRegisterRepository.findAllByTenantId(tenantId, pageable)
                .map(CashRegisterResponse::fromEntity));
    }

    @Override
    @Transactional(readOnly = true)
    public CashRegisterResponse getOpenRegister() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException("Tenant ativo obrigatório para consultar o caixa.");
        }

        CashRegister register = cashRegisterRepository.findOpenByTenantId(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Nenhum caixa aberto para este tenant."));

        BigDecimal liveCash = paymentRepository.sumByTenantIdAndMethodAndCreatedAtGreaterThanEqual(
                tenantId, PaymentMethod.CASH, register.getOpenedAt());
        BigDecimal liveCard = paymentRepository.sumByTenantIdAndMethodAndCreatedAtGreaterThanEqual(
                tenantId, PaymentMethod.CARD, register.getOpenedAt())
                .add(paymentRepository.sumByTenantIdAndMethodAndCreatedAtGreaterThanEqual(
                        tenantId, PaymentMethod.PIX, register.getOpenedAt()));

        return CashRegisterResponse.withLiveTotals(
                register,
                liveCash == null ? BigDecimal.ZERO : liveCash,
                liveCard == null ? BigDecimal.ZERO : liveCard
        );
    }
}
