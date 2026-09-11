import React from 'react';

export function getStatusStyle(status, accentSoft = '#eff6ff', accentHover = '#1d4ed8') {
  const styles = {
    Confirmado: { bg: '#f0fdf4', fg: '#15803d' },
    Pago: { bg: '#f0fdf4', fg: '#15803d' },
    Concluído: { bg: '#f0fdf4', fg: '#15803d' },
    Livre: { bg: '#f0fdf4', fg: '#15803d' },
    Pendente: { bg: '#fffbeb', fg: '#b45309' },
    Reservada: { bg: '#fffbeb', fg: '#b45309' },
    'Em preparo': { bg: accentSoft, fg: accentHover },
    Processando: { bg: accentSoft, fg: accentHover },
    Ocupada: { bg: accentSoft, fg: accentHover },
    Cancelado: { bg: '#fef2f2', fg: '#b91c1c' },
    Falhou: { bg: '#fef2f2', fg: '#b91c1c' },
    'Conta pedida': { bg: '#fef2f2', fg: '#b91c1c' },
    Rascunho: { bg: '#f1f5f9', fg: '#475569' }
  };
  return styles[status] || styles.Rascunho;
}

export default function StatusBadge({ status, accentSoft = '#eff6ff', accentHover = '#1d4ed8' }) {
  const { bg, fg } = getStatusStyle(status, accentSoft, accentHover);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        fontSize: '11.5px',
        fontWeight: 600,
        borderRadius: '999px',
        padding: '5px 12px',
        background: bg,
        color: fg,
        whiteSpace: 'nowrap'
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: fg,
          flexShrink: 0
        }}
      />
      {status}
    </span>
  );
}
