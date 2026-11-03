export const XLSX_SCRIPT_URL = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
// As planilhas ficam no repositório privado do GitHub; quem as busca é a
// função do servidor em api/planilhas/[arquivo].js (o token não vem ao navegador).
export const WMS_URL = "/api/planilhas/wms";
export const SINGRA_URL = "/api/planilhas/singra";

// --- MAPEAMENTO PADRÃO DE CORES POR STATUS ---
export const STATUS_COLOR_MAP = {
  'CONFERIDO': '#10b981',       // Esmeralda (Sucesso/Final de fluxo)
  'CONFERENCIA': '#8b5cf6',     // Violeta
  'EM CONFERENCIA': '#8b5cf6',  // Violeta
  'SEPARACAO': '#f59e0b',       // Âmbar
  'EM SEPARACAO': '#f59e0b',    // Âmbar
  'SEPARADO': '#f59e0b',        // Âmbar
  'PLANEJAMENTO': '#3b82f6',    // Azul
  'EM PLANEJAMENTO': '#3b82f6', // Azul
  'RESERVADO': '#6366f1',       // Índigo
  'EM ATENDIMENTO': '#06b6d4',  // Ciano
  'PENDENTE': '#94a3b8',        // Slate (Neutro)
  'N/A': '#cbd5e1'              // Cinza claro
};

export const getStatusColor = (status) => {
  const normalized = String(status || "").toUpperCase().trim();
  return STATUS_COLOR_MAP[normalized] || '#94a3b8';
};
