import { useMemo } from 'react';
import { safeGetISODate } from '../utils/dates';

// Classifica um valor da coluna STC em 'GTC' (ex: "GTC 002/2026") ou 'STC'
// (ex: "003/2026" — sem o prefixo). Ambos convivem na mesma coluna.
export const classifyStc = (rawValue) => {
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

// GTC é entrega em local próximo — a expedição depende só do depósito, por
// isso o prazo é apertado (10 dias). STC vai para outro estado via outra
// OM: hoje não temos a data em que a STC é de fato inserida no pedido (só
// vemos o pedido "virar" STC olhando o histórico de status), então a
// responsabilidade do depósito termina antes da expedição registrada no
// sistema — o prazo de 45 dias é mais largo para compensar esse tempo que
// não conseguimos medir separadamente.
export const META_SLA_DIAS_POR_TIPO = { STC: 45, GTC: 10 };

// Tendência linear simples (mínimos quadrados) sobre a série mensal de
// tempo médio de processo — vira a seta ao lado da média (subindo/caindo/
// estável). Uma variação total, ao longo de toda a série, menor que 5% da
// média conta como estável — pedido explícito é "simples e rápido", não um
// teste estatístico de significância.
const TREND_STABLE_THRESHOLD = 0.05;
const linearTrendDirection = (points) => {
  if (points.length < 2) return null;
  const n = points.length;
  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
  const sumXX = points.reduce((acc, p) => acc + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 'flat';
  const slope = (n * sumXY - sumX * sumY) / denom;
  const meanY = sumY / n;
  if (meanY === 0) return 'flat';
  const totalChangeRatio = (slope * (n - 1)) / meanY;
  if (totalChangeRatio > TREND_STABLE_THRESHOLD) return 'up';
  if (totalChangeRatio < -TREND_STABLE_THRESHOLD) return 'down';
  return 'flat';
};

const AGING_BUCKET_DEFS = [
  { name: '0-7 dias', min: 0, max: 7 },
  { name: '8-15 dias', min: 8, max: 15 },
  { name: '16-30 dias', min: 16, max: 30 },
  { name: '30+ dias', min: 31, max: Infinity }
];

const statusOf = (item) => String(item.STATUS || "").toUpperCase().trim();

// Tempo total do processo (liberação -> expedição), sua tendência mensal, e
// a situação dos DOCUMENTOS STC/GTC (não dos pedidos) — um mesmo STC ou GTC
// agrupa vários pedidos, então "quantos STC eu tenho" é uma pergunta sobre
// valores distintos da coluna STC, não sobre linhas da planilha. RMs sem
// STC nem GTC são ignoradas de propósito — essa é uma leitura sobre a
// saúde dos documentos, não sobre a fila geral (isso já está na aba "RM em
// processamento").
export const useStcGtcAnalysis = (data, chartData, visibleRange) => {
  return useMemo(() => {
    const empty = { groups: [], monthlyTrend: [], documents: [], pendingOrders: [], hasData: false };
    if (!data.length) return empty;

    // Agrupa cada pedido pelo valor distinto da coluna STC (o "documento").
    const docsByType = { STC: new Map(), GTC: new Map() };
    data.forEach(item => {
      const type = classifyStc(item.STC);
      if (!type) return;
      const key = String(item.STC).trim().toUpperCase();
      if (!docsByType[type].has(key)) docsByType[type].set(key, []);
      docsByType[type].get(key).push(item);
    });

    const today = new Date();
    const pendingOrders = [];

    // --- Situação de cada documento (agora, sem depender do período) ---
    // Concluído: todos os pedidos não cancelados já foram expedidos.
    // Parcial: alguns expedidos, outros ainda não.
    // Pendente: nenhum pedido do documento foi expedido ainda.
    const documents = TYPES.map(type => {
      let completedDocuments = 0, partialDocuments = 0, pendingDocuments = 0;
      const pedidosPendentes = [];
      const agingBuckets = AGING_BUCKET_DEFS.map(b => ({ ...b, count: 0 }));
      // Documentos (não pedidos) em situação parcial ou pendente, com o(s)
      // CAM(s) associado(s) — é isso que o gestor precisa ver ao clicar em
      // "Parciais"/"Pendentes": quais STC/GTC estão travados e para quem
      // (CAM) é a entrega, não a lista crua de pedidos.
      const partialList = [];
      const pendingList = [];

      docsByType[type].forEach((pedidosDoDocumento, stcKey) => {
        const naoCancelados = pedidosDoDocumento.filter(p => statusOf(p) !== "CANCELADO");
        if (naoCancelados.length === 0) return; // documento 100% cancelado: fora da análise de "aberto"

        const expedidos = naoCancelados.filter(p => statusOf(p) === "EXPEDIDO");
        const pendentes = naoCancelados.filter(p => statusOf(p) !== "EXPEDIDO");

        let situacao = null;
        if (pendentes.length === 0) { completedDocuments++; }
        else if (expedidos.length > 0) { partialDocuments++; situacao = 'parcial'; }
        else { pendingDocuments++; situacao = 'pendente'; }

        // Idade do DOCUMENTO = idade do seu pedido pendente mais antigo (o
        // item que está de fato travando o documento). O balde de
        // envelhecimento soma 1 por documento aqui, não 1 por pedido —
        // senão um único STC parcial com vários pedidos pendentes inflaria
        // a contagem várias vezes.
        let oldestDaysOpenDoDocumento = 0;
        const pendentesEnriquecidos = pendentes.map(p => {
          const entryDateIso = safeGetISODate(p.DATA_ENTRADA);
          const daysOpen = entryDateIso ? Math.floor((today - new Date(entryDateIso)) / (1000 * 60 * 60 * 24)) : 0;
          const enriched = { ...p, tipoDocumento: type, stcKey, daysOpen, entryDateIso };
          pedidosPendentes.push(enriched);
          if (daysOpen > oldestDaysOpenDoDocumento) oldestDaysOpenDoDocumento = daysOpen;
          return enriched;
        });
        const bucket = agingBuckets.find(b => oldestDaysOpenDoDocumento >= b.min && oldestDaysOpenDoDocumento <= b.max);
        if (bucket) bucket.count++;

        if (situacao) {
          const camList = Array.from(new Set(naoCancelados.map(p => String(p.CAM || '').trim()).filter(Boolean)));
          const avgDaysOpen = pendentesEnriquecidos.length
            ? parseFloat((pendentesEnriquecidos.reduce((acc, p) => acc + p.daysOpen, 0) / pendentesEnriquecidos.length).toFixed(1))
            : 0;
          const docSummary = {
            stcKey, type, situacao,
            camList: camList.length ? camList : ['Sem CAM'],
            pedidosCount: naoCancelados.length,
            pedidosPendentesCount: pendentesEnriquecidos.length,
            oldestDaysOpen: oldestDaysOpenDoDocumento,
            avgDaysOpen,
            pedidos: pendentesEnriquecidos
          };
          (situacao === 'parcial' ? partialList : pendingList).push(docSummary);
        }
      });

      partialList.sort((a, b) => b.oldestDaysOpen - a.oldestDaysOpen);
      pendingList.sort((a, b) => b.oldestDaysOpen - a.oldestDaysOpen);

      pendingOrders.push(...pedidosPendentes);
      pedidosPendentes.sort((a, b) => b.daysOpen - a.daysOpen);

      const totalDocuments = completedDocuments + partialDocuments + pendingDocuments;
      const openDocuments = partialDocuments + pendingDocuments;
      const completionRate = totalDocuments > 0 ? parseFloat(((completedDocuments / totalDocuments) * 100).toFixed(1)) : null;
      const avgAgePendentes = pedidosPendentes.length ? parseFloat((pedidosPendentes.reduce((acc, o) => acc + o.daysOpen, 0) / pedidosPendentes.length).toFixed(1)) : 0;

      return {
        type,
        totalDocuments, completedDocuments, partialDocuments, pendingDocuments, openDocuments,
        completionRate,
        pedidosPendentesCount: pedidosPendentes.length,
        avgAgePendentes,
        oldestPendente: pedidosPendentes[0] || null,
        agingBuckets,
        partialList,
        pendingList,
        daysToClear: null // preenchido abaixo, depende do ritmo do período selecionado
      };
    });

    pendingOrders.sort((a, b) => b.daysOpen - a.daysOpen);

    if (!chartData.length) return { groups: [], monthlyTrend: [], documents, pendingOrders, hasData: documents.some(d => d.totalDocuments > 0) };

    // --- Tempo de processo (liberação -> expedição) no período selecionado ---
    const startIndex = visibleRange ? visibleRange.startIndex : 0;
    const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;
    const startDate = new Date(chartData[startIndex]?.date);
    const endDate = new Date(chartData[endIndex]?.date);
    const numDias = endIndex - startIndex + 1;

    const leadTimesByType = { STC: [], GTC: [] };
    const documentsSeenByType = { STC: new Set(), GTC: new Set() };
    const onTimeCountByType = { STC: 0, GTC: 0 };
    const monthlyByType = {}; // { 'YYYY-MM': { STC: [dias...], GTC: [dias...] } }

    data.forEach(item => {
      if (statusOf(item) !== "EXPEDIDO") return;

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
      documentsSeenByType[type].add(String(item.STC).trim().toUpperCase());
      if (diffDays <= META_SLA_DIAS_POR_TIPO[type]) onTimeCountByType[type]++;

      const monthKey = sepStr.substring(0, 7);
      if (!monthlyByType[monthKey]) monthlyByType[monthKey] = { STC: [], GTC: [] };
      monthlyByType[monthKey][type].push(diffDays);
    });

    const groups = TYPES.map(type => {
      const times = leadTimesByType[type];
      return {
        type,
        pedidoCount: times.length,
        documentCount: documentsSeenByType[type].size,
        avgDays: parseFloat(average(times).toFixed(1)),
        medianDays: parseFloat(median(times).toFixed(1)),
        onTimeRate: times.length > 0 ? parseFloat(((onTimeCountByType[type] / times.length) * 100).toFixed(1)) : null,
        metaSlaDias: META_SLA_DIAS_POR_TIPO[type]
      };
    });

    // Previsão de zeragem por tipo: no ritmo de expedição do período
    // selecionado, quantos dias faltam para zerar os pedidos pendentes
    // daquele tipo?
    const groupsByType = Object.fromEntries(groups.map(g => [g.type, g]));
    documents.forEach(doc => {
      const throughputPerDay = numDias > 0 ? groupsByType[doc.type].pedidoCount / numDias : 0;
      doc.daysToClear = throughputPerDay > 0 ? parseFloat((doc.pedidosPendentesCount / throughputPerDay).toFixed(1)) : null;
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

    const groupsWithTrend = groups.map(g => {
      const points = monthlyTrend
        .map((m, idx) => ({ x: idx, y: m[`${g.type}_avg`] }))
        .filter(p => p.y !== null && p.y !== undefined);
      return { ...g, trend: linearTrendDirection(points) };
    });

    return {
      groups: groupsWithTrend,
      monthlyTrend,
      documents,
      pendingOrders,
      hasData: groups.some(g => g.pedidoCount > 0) || documents.some(d => d.totalDocuments > 0)
    };
  }, [data, chartData, visibleRange]);
};
