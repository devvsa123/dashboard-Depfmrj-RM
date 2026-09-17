import { SINGRA_URL } from '../constants';
import { safeGetISODate } from './dates';

// Normaliza as chaves de um objeto vindo de planilha: remove aspas, acentos e
// padroniza para maiúsculas, já que WMS e SINGRA usam cabeçalhos inconsistentes.
export const normalizeKeys = (item) => {
  const newItem = {};
  Object.keys(item).forEach(key => {
    const cleanKeyRaw = key.replace(/['"]/g, '');
    const normalizedKey = cleanKeyRaw.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    newItem[normalizedKey] = item[key];
  });
  return newItem;
};

export const fetchSingraOnly = async () => {
  try {
    const res = await fetch(`${SINGRA_URL}?t=${Date.now()}`);
    if (!res.ok) return [];
    const text = await res.text();
    let json = [];

    if (text.includes(';') && !text.startsWith('PK')) {
      const lines = text.split('\n');
      const headers = lines[0].split(';').map(h => h.replace(/['"]/g, '').trim());
      json = lines.slice(1).filter(l => l.trim()).map(line => {
        const values = line.split(';').map(v => v.replace(/['"]/g, '').trim());
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i]);
        return obj;
      });
    } else {
      const arrayBuffer = new TextEncoder().encode(text);
      const wb = window.XLSX.read(arrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      json = window.XLSX.utils.sheet_to_json(ws);
    }

    return json.map(normalizeKeys);
  } catch (err) {
    console.error("Erro ao puxar Singra avulso", err);
    return [];
  }
};

export const downloadExcel = (dataSet, sheetName) => {
  if (!dataSet || dataSet.length === 0) return;
  const exportData = dataSet.map(item => ({
    CAM: item.cam || item.CAM || "-",
    PEDIDO: item.idOriginal || item.PEDIDO || item.RM || "S/N",
    CAPA: item.capa || item.CAPA || "-", // NOVA COLUNA CAPA
    STC: item.stc || item.STC || "-",
    STATUS_WMS: item.wmsStatus || item.STATUS || "-",
    STATUS_SINGRA: item.singraStatus || "-",
    DATA_ENTRADA: item.dataEntrada || item.entryDateIso || (item.DATA_ENTRADA ? safeGetISODate(item.DATA_ENTRADA) : "-"),
    DATA_EXPEDICAO: item.dataSeparacao || (item.DATA_SEPARACAO ? safeGetISODate(item.DATA_SEPARACAO) : "-"),
    LOTE: item.lote || item.LOTE || "-", // NOVA COLUNA LOTE
    ...(item.daysOpen !== undefined ? { DIAS_EM_ABERTO: item.daysOpen } : {})
  }));

  const ws = window.XLSX.utils.json_to_sheet(exportData);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, "Dados");
  window.XLSX.writeFile(wb, `${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`);
};
