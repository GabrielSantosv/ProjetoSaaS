import React from 'react';

export default function ImageSlot({ id, hint, shape = 'rect', fit = 'cover' }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        color: '#94a3b8',
        textAlign: 'center',
        userSelect: 'none'
      }}
    >
      <span
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '8px'
        }}
      >
        <span
          style={{
            width: '10px',
            height: '10px',
            border: '2px solid #94a3b8',
            borderRadius: '2px',
            transform: 'rotate(45deg)'
          }}
        />
      </span>
      <span style={{ fontSize: '11px', letterSpacing: '0.05em' }}>{hint || 'Imagem'}</span>
    </div>
  );
}
