import React, { useState, useEffect, useRef } from 'react';
import StatusBadge, { getStatusStyle } from '../components/StatusBadge';
import { getToken } from '../utils/auth';

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8080';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // limite real do backend (max-file-size/max-request-size)
const POLL_INTERVAL_MS = 1500;

const STATUS_TO_LABEL = { PENDING: 'Pendente', PROCESSING: 'Processando', COMPLETED: 'Concluído', FAILED: 'Falhou' };

async function apiRequest(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.details?.length ? body.details.join(' ') : (body?.message || 'Não foi possível completar a operação.');
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

function mapJobFromApi(j) {
  return {
    id: j.id,
    file: j.fileName,
    kind: 'Catálogo', // único tipo real que este endpoint importa — não existe "kind" no backend
    total: Number(j.totalRows) || 0,
    done: Number(j.processedRows) || 0,
    status: STATUS_TO_LABEL[j.status] || j.status,
    errors: Number(j.errorCount) || 0,
    message: j.message || null
  };
}

// Um card por job, com o próprio ciclo de polling — isolado por jobId via o efeito
// desta instância, não um loop global que um novo upload poderia atropelar.
function ImportJobCard({ job, accentSoft, accentHover, onUpdate, onOpenReport }) {
  useEffect(() => {
    if (job.status !== 'Processando' && job.status !== 'Pendente') return;

    const interval = setInterval(async () => {
      try {
        const data = await apiRequest(`/api/v1/imports/${job.id}/status`);
        onUpdate(mapJobFromApi(data));
      } catch {
        // falha pontual de rede durante o polling — tenta de novo no próximo tick
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [job.status, job.id]);

  const b = getStatusStyle(job.status, accentSoft, accentHover);
  const pctNum = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
  const pctStr = `${pctNum}%`;
  const showCatastrophicMessage = job.errors === 0 && job.status === 'Falhou' && job.message;

  return (
    <div
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
                borderRadius: job.status === 'Concluído' ? '999px' : '2px'
              }}
            />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{job.file}</span>
            <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
              {job.kind} · {job.total.toLocaleString('pt-BR')} linhas
            </span>
          </div>
        </div>
        <StatusBadge status={job.status} accentSoft={accentSoft} accentHover={accentHover} />
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
          <span>{job.done.toLocaleString('pt-BR')} de {job.total.toLocaleString('pt-BR')} linhas processadas</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: b.fg, fontWeight: 600 }}>{pctStr}</span>
        </div>
      </div>

      {job.errors > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', background: '#fef2f2', borderRadius: '16px', padding: '13px 16px' }}>
          <span style={{ fontSize: '12.5px', color: '#b91c1c' }}>{job.errors} linhas com erro de validação</span>
          <button
            onClick={() => onOpenReport(job.id)}
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

      {showCatastrophicMessage && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', background: '#fef2f2', borderRadius: '16px', padding: '13px 16px' }}>
          <span style={{ fontSize: '12.5px', color: '#b91c1c' }}>{job.message}</span>
        </div>
      )}
    </div>
  );
}

export default function ImportView({
  accentColor = '#2563eb'
}) {
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const [reportJobId, setReportJobId] = useState(null);
  const [reportPage, setReportPage] = useState(1);
  const [reportErrors, setReportErrors] = useState([]);
  const [reportTotalErrors, setReportTotalErrors] = useState(0);
  const [reportTotalPages, setReportTotalPages] = useState(1);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState(null);

  const mix = (pct, other) => `color-mix(in oklab, ${accentColor} ${pct}%, ${other})`;
  const accentHover = mix(85, '#0f172a');
  const accentSoft = mix(11, '#ffffff');
  const accentGlow = `color-mix(in oklab, ${accentColor} 32%, transparent)`;

  // Carrega a fila real uma vez ao montar — corrige proativamente a mesma race condition
  // de loading (AbortController + StrictMode) já encontrada em Produtos e Pedidos: uma
  // requisição cancelada nunca pode desligar o loading, só quem ainda está "vivo".
  useEffect(() => {
    const controller = new AbortController();
    setLoadingJobs(true);
    setJobsError(null);

    apiRequest('/api/v1/imports?page=0&size=20', { signal: controller.signal })
      .then(data => setJobs((data.content || []).map(mapJobFromApi)))
      .catch(err => {
        if (err.name === 'AbortError') return;
        setJobsError(err.message || 'Não foi possível carregar a fila de importação agora.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingJobs(false);
      });

    return () => controller.abort();
  }, []);

  const handleJobUpdate = updatedJob => {
    setJobs(prev => prev.map(j => (j.id === updatedJob.id ? updatedJob : j)));
  };

  const runningCount = jobs.filter(j => j.status === 'Processando' || j.status === 'Pendente').length;
  const queueSummary = runningCount ? `${runningCount} arquivo(s) processando agora` : 'nenhum arquivo processando';

  const uploadFile = async file => {
    if (!file) return;
    setUploadError(null);

    if (file.size > MAX_FILE_SIZE) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setUploadError(`Arquivo muito grande (${sizeMb} MB) — o limite atual é 20 MB.`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/api/v1/imports/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || 'Não foi possível enviar o arquivo agora.');
      }

      const data = await response.json();
      setJobs(prev => [mapJobFromApi(data), ...prev]);
    } catch (err) {
      setUploadError(err.message || 'Não foi possível enviar o arquivo agora.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    uploadFile(file);
  };

  const openFilePicker = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const REP_PER = 10;
  const currentRepJob = reportJobId ? jobs.find(j => j.id === reportJobId) : null;

  // Relatório de erros reais de um job — mesma proteção contra a race de loading.
  useEffect(() => {
    if (!reportJobId) return;
    const controller = new AbortController();
    setReportLoading(true);
    setReportError(null);

    const params = new URLSearchParams();
    params.set('page', String(reportPage - 1));
    params.set('size', String(REP_PER));

    apiRequest(`/api/v1/imports/${reportJobId}/errors?${params.toString()}`, { signal: controller.signal })
      .then(data => {
        setReportErrors(data.content || []);
        setReportTotalErrors(data.totalElements || 0);
        setReportTotalPages(Math.max(1, data.totalPages || 1));
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setReportError(err.message || 'Não foi possível carregar o relatório agora.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setReportLoading(false);
      });

    return () => controller.abort();
  }, [reportJobId, reportPage]);

  const downloadReport = () => {
    if (reportErrors.length === 0) return;
    const head = 'linha,motivo\n';
    const body = reportErrors.map(e => [e.rowNumber, `"${String(e.errorMessage).replace(/"/g, '""')}"`].join(',')).join('\n');
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

  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".csv"
      onChange={handleFileInputChange}
      style={{ display: 'none' }}
    />
  );

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
              disabled={reportErrors.length === 0}
              style={{
                border: '1px solid #bfdbfe',
                background: '#ffffff',
                color: accentColor,
                borderRadius: '999px',
                padding: '11px 20px',
                fontSize: '12.5px',
                fontWeight: 500,
                flex: 'none',
                cursor: reportErrors.length === 0 ? 'not-allowed' : 'pointer'
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
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '19px', color: '#334155' }}>{currentRepJob.total - currentRepJob.errors}</span>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '18px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Rejeitadas</span>
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '19px', color: '#b91c1c' }}>{currentRepJob.errors}</span>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '18px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Lote isolado</span>
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '19px', color: '#334155' }}>sim — as demais seguiram</span>
            </div>
          </div>

          {reportLoading && (
            <div style={{ padding: '30px 0', textAlign: 'center', fontSize: '12.5px', color: '#94a3b8' }}>
              Carregando relatório…
            </div>
          )}

          {!reportLoading && reportError && (
            <div style={{ padding: '30px 0', textAlign: 'center', fontSize: '12.5px', color: '#b91c1c' }}>
              {reportError}
            </div>
          )}

          {!reportLoading && !reportError && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '0.6fr 3.4fr', gap: '14px', padding: '0 4px 12px 4px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Linha</span>
                <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Motivo da rejeição</span>
              </div>
              {reportErrors.map(er => (
                <div key={er.id} style={{ display: 'grid', gridTemplateColumns: '0.6fr 3.4fr', gap: '14px', alignItems: 'center', padding: '14px 4px', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ fontSize: '12.5px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{er.rowNumber}</span>
                  <span style={{ fontSize: '12.5px', color: '#b91c1c' }}>{er.errorMessage}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifySelf: 'space-between', justifyContent: 'space-between', gap: '14px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Mostrando {reportTotalErrors === 0 ? 0 : (reportPage - 1) * REP_PER + 1}–{Math.min(reportPage * REP_PER, reportTotalErrors)} de {reportTotalErrors} linhas rejeitadas
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => setReportPage(p => Math.max(1, p - 1))}
                disabled={reportPage <= 1}
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: reportPage > 1 ? '#334155' : '#cbd5e1',
                  borderRadius: '999px',
                  padding: '9px 18px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: reportPage > 1 ? 'pointer' : 'not-allowed'
                }}
              >
                Anterior
              </button>
              <span style={{ fontSize: '12px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                Página {reportPage} de {reportTotalPages}
              </span>
              <button
                onClick={() => setReportPage(p => Math.min(reportTotalPages, p + 1))}
                disabled={reportPage >= reportTotalPages}
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: reportPage < reportTotalPages ? '#334155' : '#cbd5e1',
                  borderRadius: '999px',
                  padding: '9px 18px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: reportPage < reportTotalPages ? 'pointer' : 'not-allowed'
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
      {hiddenFileInput}
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
            onClick={openFilePicker}
            disabled={uploading}
            style={{
              border: 0,
              background: uploading ? accentHover : accentColor,
              color: '#ffffff',
              borderRadius: '999px',
              padding: '12px 24px',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: `0 14px 28px ${accentGlow}`,
              cursor: uploading ? 'not-allowed' : 'pointer'
            }}
          >
            {uploading ? 'Enviando…' : 'Enviar CSV'}
          </button>
        </div>
      </div>

      {uploadError && (
        <div style={{ background: '#fef2f2', borderRadius: '18px', padding: '14px 18px', fontSize: '12.5px', color: '#b91c1c', lineHeight: 1.5 }}>
          {uploadError}
        </div>
      )}

      {/* TWO COLUMNS: QUEUE & STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* DROPZONE */}
          <button
            onClick={openFilePicker}
            disabled={uploading}
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
              cursor: uploading ? 'not-allowed' : 'pointer'
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

            {loadingJobs && (
              <div style={{ background: '#ffffff', borderRadius: '24px', padding: '30px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', textAlign: 'center', fontSize: '12.5px', color: '#94a3b8' }}>
                Carregando fila de importação…
              </div>
            )}

            {!loadingJobs && jobsError && (
              <div style={{ background: '#ffffff', borderRadius: '24px', padding: '30px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', textAlign: 'center', fontSize: '12.5px', color: '#b91c1c' }}>
                {jobsError}
              </div>
            )}

            {!loadingJobs && !jobsError && jobs.length === 0 && (
              <div style={{ background: '#ffffff', borderRadius: '24px', padding: '30px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', textAlign: 'center', fontSize: '12.5px', color: '#94a3b8' }}>
                Nenhum arquivo enviado ainda.
              </div>
            )}

            {!loadingJobs && !jobsError && jobs.map(j => (
              <ImportJobCard
                key={j.id}
                job={j}
                accentSoft={accentSoft}
                accentHover={accentHover}
                onUpdate={handleJobUpdate}
                onOpenReport={id => {
                  setReportJobId(id);
                  setReportPage(1);
                }}
              />
            ))}
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
