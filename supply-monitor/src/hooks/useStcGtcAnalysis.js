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

const TYPES = ["STC", "GTC"];

// Tempo total do processo (liberação -> expedição) para pedidos finalizados
// com STC/GTC, a tendência mensal desses tempos e o quanto ainda está
// pendente (com STC/GTC atribuído, mas ainda não expedido). RMs sem STC
// nem GTC são ignoradas aqui de propósito — essa é uma leitura sobre a
// saúde dos documentos, não sobre a fila geral (isso já está na aba "RM em
// processamento").
export const useStcGtcAnalysis = (data, chartData, visibleRange) => {
  return useMemo(() => {
    const empty = { groups: [], monthlyTrend: [], pending: [], pendingOrders: [], completionRate: [], hasData: false };
    if (!data.length) return empty;

    // --- Snapshot atual: o que tem STC/GTC e ainda não foi expedido ---
    // Não depende do período selecionado no dashboard — é sempre "agora".
    const pendingOrdersByType = { STC: [], GTC: [] };
    data.forEach(item => {
      const type = classifyStc(item.STC);
      if (!type) return;
      const status = String(item.STATUS || "").toUpperCase().trim();
      if (status === "EXPEDIDO" || status === "CANCELADO") return;

      const entryDateIso = safeGetISODate(item.DATA_ENTRADA);
      let daysOpen = 0;
      if (entryDateIso) {
        daysOpen = Math.floor((new Date() - new Date(entryDateIso)) / (1000 * 60 * 60 * 24));
      }
      pendingOrdersByType[type].push({ ...item, tipoDocumento: type, daysOpen, entryDateIso });
    });

    const pending = TYPES.map(type => {
      const orders = pendingOrdersByType[type].sort((a, b) => b.daysOpen - a.daysOpen);
      return {
        type,
        count: orders.length,
        avgAge: orders.length ? parseFloat((orders.reduce((acc, o) => acc + o.daysOpen, 0) / orders.length).toFixed(1)) : 0,
        oldestOrder: orders[0] || null
      };
    });
    const pendingOrders = [...pendingOrdersByType.STC, ...pendingOrdersByType.GTC].sort((a, b) => b.daysOpen - a.daysOpen);

    // --- Taxa de conclusão: dos que já têm STC/GTC, quantos já saíram? ---
    const expedidoCountByType = { STC: 0, GTC: 0 };
    data.forEach(item => {
      const type = classifyStc(item.STC);
      if (!type) return;
      if (String(item.STATUS || "").toUpperCase().trim() === "EXPEDIDO") expedidoCountByType[type] += 1;
    });
    const completionRate = TYPES.map(type => {
      const expedido = expedidoCountByType[type];
      const total = expedido + pendingOrdersByType[type].length;
      return { type, rate: total > 0 ? parseFloat(((expedido / total) * 100).toFixed(1)) : null, expedido, total };
    });

    if (!chartData.length) return { ...empty, pending, pendingOrders, completionRate };

    // --- Tempo de processo (liberação -> expedição) no período selecionado ---
    const startIndex = visibleRange ? visibleRange.startIndex : 0;
    const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;
    const startDate = new Date(chartData[startIndex]?.date);
    const endDate = new Date(chartData[endIndex]?.date);

    const leadTimesByType = { STC: [], GTC: [] };
    const monthlyByType = {}; // { 'YYYY-MM': { STC: [dias...], GTC: [dias...] } }

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
      if (diffDays < 0) return;

      leadTimesByType[type].push(diffDays);

      const monthKey = sepStr.substring(0, 7);
      if (!monthlyByType[monthKey]) monthlyByType[monthKey] = { STC: [], GTC: [] };
      monthlyByType[monthKey][type].push(diffDays);
    });

    const groups = TYPES.map(type => {
      const times = leadTimesByType[type];
      return {
        type,
        count: times.length,
        avgDays: parseFloat(average(times).toFixed(1)),
        medianDays: parseFloat(median(times).toFixed(1))
      };
    });

    const monthlyTrend = Object.entries(monthlyByType)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, byType]) => ({
        month,
        STC_avg: byType.STC.length ? parseFloat(average(byType.STC).toFixed(1)) : null,
        GTC_avg: byType.GTC.length ? parseFloat(average(byType.GTC).toFixed(1)) : null,
        STC_count: byType.STC.length,
        GTC_count: byType.GTC.length
      }));

    return {
      groups,
      monthlyTrend,
      pending,
      pendingOrders,
      completionRate,
      hasData: groups.some(g => g.count > 0)
    };
  }, [data, chartData, visibleRange]);
};
