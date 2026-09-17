import { useMemo } from 'react';
import { safeGetISODate } from '../utils/dates';

// Classifica um valor da coluna STC em 'GTC' (ex: "GTC 002/2026") ou 'STC'
// (ex: "003/2026" — sem o prefixo). Ambos convivem na mesma coluna.
const classifyStc = (rawValue) => {
  const value = String(rawValue || "").trim();
  if (!value || value === "-") return null;
  return value.toUpperCase().startsWith("GTC") ? "GTC" : "STC";
};

const average = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

const median = (arr) => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Tempo total do processo (liberação -> expedição) para pedidos finalizados,
// segmentado por tipo de documento (STC x GTC), dentro do período selecionado.
export const useStcGtcAnalysis = (data, chartData, visibleRange) => {
  return useMemo(() => {
    const empty = { groups: [], hasData: false };
    if (!data.length || !chartData.length) return empty;

    const startIndex = visibleRange ? visibleRange.startIndex : 0;
    const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;
    const startDate = new Date(chartData[startIndex]?.date);
    const endDate = new Date(chartData[endIndex]?.date);

    const leadTimesByType = { STC: [], GTC: [] };

    data.forEach(item => {
      const status = String(item.STATUS || "").toUpperCase().trim();
      if (status !== "EXPEDIDO") return;

      const type = classifyStc(item.STC);
      if (!type) return;

      const entryStr = safeGetISODate(item.DATA_ENTRADA);
      const sepStr = safeGetISODate(item.DATA_SEPARACAO);
      if (!entryStr || !sepStr) return;

      const sepDate = new Date(sepStr);
      if (sepDate < startDate || sepDate > endDate) return;

      const diffDays = Math.ceil((sepDate - new Date(entryStr)) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) leadTimesByType[type].push(diffDays);
    });

    const groups = ["STC", "GTC"].map(type => {
      const times = leadTimesByType[type];
      return {
        type,
        count: times.length,
        avgDays: parseFloat(average(times).toFixed(1)),
        medianDays: parseFloat(median(times).toFixed(1))
      };
    });

    return { groups, hasData: groups.some(g => g.count > 0) };
  }, [data, chartData, visibleRange]);
};
