import React, { useState, useEffect } from 'react';
import StatusBadge, { getStatusStyle } from '../components/StatusBadge';

export default function ImportView({
  accentColor = '#2563eb'
}) {
  const [jobs, setJobs] = useState([
    { id: 1, file: 'catalogo-fornecedor-aurora.csv', kind: 'Catálogo', total: 4820, done: 3100, status: 'Processando', speed: 55 },
    { id: 2, file: 'estoque-loja-centro.csv', kind: 'Estoque', total: 1240, done: 1240, status: 'Concluído', speed: 0 },
    { id: 3, file: 'clientes-legado-2024.csv', kind: 'Clientes', total: 9600, done: 2400, status: 'Processando', speed: 90, errors: 37 },
    { id: 4, file: 'precos-julho.csv', kind: 'Preços', total: 610, done: 180, status: 'Falhou', speed: 0, errors: 12 }
  ]);

  const [reportJobId, setReportJobId] = useState(null);
  const [reportPage, setReportPage] = useState(1);

  const mix = (pct, other) => `color-mix(in oklab, ${accentColor} ${pct}%, ${other})`;
  const accentHover = mix(85, '#0f172a');
  const accentSoft = mix(11, '#ffffff');
  const accentGlow = `color-mix(in oklab, ${accentColor} 32%, transparent)`;

  // Ticker timer for background processing
  useEffect(() => {
    const hasRunning = jobs.some(j => j.status === 'Processando');
    if (!hasRunning) return;

    const timer = setInterval(() => {
      setJobs(prevJobs => {
        const stillRunning = prevJobs.some(j => j.status === 'Processando');
        if (!stillRunning) {
          clearInterval(timer);
          return prevJobs;
        }

        return prevJobs.map(j => {
          if (j.status !== 'Processando') return j;
          const nextDone = Math.min(j.total, j.done + (j.speed || 50));
          return {
            ...j,
            done: nextDone,
            status: nextDone >= j.total ? 'Concluído' : 'Processando'
          };
        });
      });
    }, 900);

    return () => clearInterval(timer);
  }, [jobs]);

  const runningCount = jobs.filter(j => j.status === 'Processando').length;
  const queueSummary = runningCount ? `${runningCount} arquivo(s) processando agora` : 'nenhum arquivo processando';

  const addJob = () => {
    const newId = Date.now();
    const newJob = {
      id: newId,
      file: `novo-catalogo-${jobs.length + 1}.csv`,
      kind: 'Catálogo',
      total: 2400,
      done: 0,
      status: 'Processando',
      speed: 70
    };
    setJobs(prev => [newJob, ...prev]);
  };

  const REASONS = [
    { column: 'sku', reason: 'SKU ausente na linha' },
    { column: 'preco_venda', reason: 'Preço com formato inválido (esperado 0,00)' },
    { column: 'sku', reason: 'SKU duplicado no mesmo arquivo' },
    { column: 'estoque', reason: 'Quantidade negativa não permitida' },
    { column: 'categoria', reason: 'Categoria não cadastrada' },
    { column: 'preco_custo', reason: 'Custo maior que o preço de venda' },
    { column: 'unidade', reason: 'Unidade fora da lista (un, kg, cx)' }
  ];

  const currentRepJob = reportJobId ? jobs.find(j => j.id === reportJobId) : null;
  const repErrors = currentRepJob
    ? Array.from({ length: currentRepJob.errors || 0 }, (_, i) => {
        const r = REASONS[i % REASONS.length];
        return {
          id: `e${i}`,
          line: 12 + i * 7,
          sku: `AUR-${1040 + i * 3}`,
          column: r.column,
          reason: r.reason
        };
      })
    : [];

  const REP_PER = 10;
  const repPages = Math.max(1, Math.ceil(repErrors.length / REP_PER));
  const validRepPage = Math.min(reportPage, repPages);
  const repSlice = repErrors.slice((validRepPage - 1) * REP_PER, validRepPage * REP_PER);

  const downloadReport = () => {
    const head = 'linha,sku,coluna,motivo\n';
    const body = repErrors.map(e => [e.line, e.sku, e.column, `"${e.reason}"`].join(',')).join('\n');
    const blob = new Blob([head + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `erros-${currentRepJob ? currentRepJob.file.replace(/\.csv$/, '') : 'import'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const importStats = [
    { label: 'Arquivos enviados', value: '12', status: 'Concluído' },
    { label: 'Linhas importadas', value: '38.4k', status: 'Processando' },
    { label: 'Linhas com erro', value: '49', status: 'Falhou' }
  ];

  const columns = ['sku', 'nome', 'preco', 'estoque', 'categoria', 'codigo_barras', 'unidade'];

  if (reportJobId && currentRepJob) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <button
          onClick={() => setReportJobId(null)}
          style={{
            alignSelf: 'flex-start',
            border: 0,
            background: 'transparent',
            padding: 0,
            fontSize: '12.5px',
            color: '#94a3b8',
            cursor: 'pointer'
          }}
        >
          ← Voltar à fila de importação
        </button>

        <div
          style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '28px',
            boxShadow: '0 24px 55px rgba(2,6,23,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '22px'
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0 }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b91c1c', fontWeight: 600 }}>
                Relatório de erros
              </div>
              <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '28px', letterSpacing: '-0.02em', color: '#334155' }}>
                {currentRepJob.file}
              </h2>
              <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                {currentRepJob.kind} · linhas rejeitadas não interrompem o restante do lote
              </span>
            </div>
            <button
              onClick={downloadReport}
              style={{
                border: '1px solid #bfdbfe',
                background: '#ffffff',
                color: accentColor,
                borderRadius: '999px',
                padding: '11px 20px',
                fontSize: '12.5px',
                fontWeight: 500,
                flex: 'none',
                cursor: 'pointer'
              }}
            >
              Baixar CSV de erros
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '12px' }}>
            <div style={{ background: '#f8fafc', borderRadius: '18px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Linhas no arquivo</span>
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '19px', color: '#334155' }}>{currentRepJob.total}</span>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '18px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Importadas com sucesso</span>
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '19px', color: '#334155' }}>{currentRepJob.total - repErrors.length}</span>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '18px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Rejeitadas</span>
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '19px', color: '#b91c1c' }}>{repErrors.length}</span>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '18px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Lote isolado</span>
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '19px', color: '#334155' }}>sim — as demais seguiram</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '0.6fr 0.9fr 1fr 2.2fr', gap: '14px', padding: '0 4px 12px 4px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Linha</span>
              <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>SKU</span>
              <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Coluna</span>
              <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Motivo da rejeição</span>
            </div>
            {repSlice.map(er => (
              <div key={er.id} style={{ display: 'grid', gridTemplateColumns: '0.6fr 0.9fr 1fr 2.2fr', gap: '14px', alignItems: 'center', padding: '14px 4px', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ fontSize: '12.5px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{er.line}</span>
                <span style={{ fontSize: '12.5px', color: '#334155' }}>{er.sku}</span>
                <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'ui-monospace, monospace' }}>{er.column}</span>
                <span style={{ fontSize: '12.5px', color: '#b91c1c' }}>{er.reason}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifySelf: 'space-between', justifyContent: 'space-between', gap: '14px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Mostrando {(validRepPage - 1) * REP_PER + 1}–{Math.min(validRepPage * REP_PER, repErrors.length)} de {repErrors.length} linhas rejeitadas
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => setReportPage(p => Math.max(1, p - 1))}
                disabled={validRepPage <= 1}
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: validRepPage > 1 ? '#334155' : '#cbd5e1',
                  borderRadius: '999px',
                  padding: '9px 18px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: validRepPage > 1 ? 'pointer' : 'not-allowed'
                }}
              >
                Anterior
              </button>
              <span style={{ fontSize: '12px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                Página {validRepPage} de {repPages}
              </span>
              <button
                onClick={() => setReportPage(p => Math.min(repPages, p + 1))}
                disabled={validRepPage >= repPages}
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: validRepPage < repPages ? '#334155' : '#cbd5e1',
                  borderRadius: '999px',
                  padding: '9px 18px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: validRepPage < repPages ? 'pointer' : 'not-allowed'
                }}
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '28px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '620px' }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
            Feature central
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "'Fraunces', Georgia, serif",
              fontWeight: 700,
              fontSize: '44px',
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
              color: '#1e293b'
            }}
          >
            Importação
          </h1>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.65, color: '#64748b' }}>
            Envie planilhas CSV de catálogo, estoque ou clientes. Cada arquivo virá com progresso ao vivo, linha a linha, e relatório de erros ao final.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            style={{
              border: '1px solid #bfdbfe',
              background: '#ffffff',
              color: accentColor,
              borderRadius: '999px',
              padding: '12px 22px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Baixar modelo
          </button>
          <button
            onClick={addJob}
            style={{
              border: 0,
              background: accentColor,
              color: '#ffffff',
              borderRadius: '999px',
              padding: '12px 24px',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: `0 14px 28px ${accentGlow}`,
              cursor: 'pointer'
            }}
          >
            Enviar CSV
          </button>
        </div>
      </div>

      {/* TWO COLUMNS: QUEUE & STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* DROPZONE */}
          <button
            onClick={addJob}
            style={{
              width: '100%',
              border: '2px dashed #cbd5e1',
              background: '#ffffff',
              borderRadius: '24px',
              padding: '40px 30px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              boxShadow: '0 24px 55px rgba(2,6,23,0.05)',
              cursor: 'pointer'
            }}
          >
            <span
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '999px',
                background: accentSoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span
                style={{
                  width: '16px',
                  height: '16px',
                  background: accentColor,
                  borderRadius: '2px',
                  transform: 'rotate(45deg)'
                }}
              />
            </span>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '21px', color: '#334155' }}>
              Arraste o arquivo CSV aqui
            </span>
            <span style={{ fontSize: '12.5px', color: '#94a3b8', textAlign: 'center', lineHeight: 1.6 }}>
              ou clique para escolher · até 50 MB · delimitador vírgula ou ponto e vírgula
            </span>
          </button>

          {/* QUEUE LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
                Fila de processamento
              </div>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
              <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{queueSummary}</div>
            </div>

            {jobs.map(j => {
              const b = getStatusStyle(j.status, accentSoft, accentHover);
              const pctNum = Math.round((j.done / j.total) * 100);
              const pctStr = `${pctNum}%`;

              return (
                <div
                  key={j.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '24px',
                    padding: '24px 26px',
                    boxShadow: '0 24px 55px rgba(2,6,23,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                      <span
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '999px',
                          background: b.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: 'none'
                        }}
                      >
                        <span
                          style={{
                            width: '13px',
                            height: '13px',
                            background: b.fg,
                            borderRadius: j.status === 'Concluído' ? '999px' : '2px'
                          }}
                        />
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{j.file}</span>
                        <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                          {j.kind} · {j.total.toLocaleString('pt-BR')} linhas · enviado por Helena
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={j.status} accentSoft={accentSoft} accentHover={accentHover} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                    <div style={{ height: '8px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          borderRadius: '999px',
                          width: pctStr,
                          background: b.fg,
                          transition: 'width 0.5s linear'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', fontSize: '11.5px', color: '#94a3b8' }}>
                      <span>{j.done.toLocaleString('pt-BR')} de {j.total.toLocaleString('pt-BR')} linhas processadas</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: b.fg, fontWeight: 600 }}>{pctStr}</span>
                    </div>
                  </div>

                  {j.errors && j.errors > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', background: '#fef2f2', borderRadius: '16px', padding: '13px 16px' }}>
                      <span style={{ fontSize: '12.5px', color: '#b91c1c' }}>{j.errors} linhas com erro de validação</span>
                      <button
                        onClick={() => {
                          setReportJobId(j.id);
                          setReportPage(1);
                        }}
                        style={{
                          border: 0,
                          background: '#ffffff',
                          color: '#b91c1c',
                          borderRadius: '999px',
                          padding: '7px 15px',
                          fontSize: '12px',
                          fontWeight: 500,
                          flex: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        Ver relatório
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SIDE COLUMN: STATS & EXPECTED COLUMNS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '104px' }}>
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '26px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
              Hoje
            </div>
            {importStats.map((s, idx) => {
              const b = getStatusStyle(s.status, accentSoft, accentHover);
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '34px', height: '34px', borderRadius: '999px', background: b.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: b.fg }} />
                    </span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>{s.label}</span>
                  </div>
                  <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '22px', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                    {s.value}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '26px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
              Colunas esperadas
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {columns.map(c => (
                <span key={c} style={{ fontSize: '11.5px', fontWeight: 500, borderRadius: '999px', padding: '6px 12px', background: '#f8fafc', color: '#475569' }}>
                  {c}
                </span>
              ))}
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', lineHeight: 1.6, color: '#94a3b8' }}>
              Colunas extras são ignoradas. Linhas sem SKU vão para o relatório de erros sem interromper o job.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
