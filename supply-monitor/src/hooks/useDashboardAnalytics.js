import { useEffect, useMemo, useState } from 'react';
import { safeGetISODate } from '../utils/dates';

// Série diária (entradas/saídas/lead time), o recorte visível do Brush e os
// indicadores agregados (SLA, balanço, cancelados x liberados, PIs) do
// período selecionado no dashboard.
export const useDashboardAnalytics = (data) => {
  // Correção de Inicialização: O estado default agora é `null` para assumir o tamanho completo dos dados
  const [visibleRange, setVisibleRange] = useState(null);

  const chartData = useMemo(() => {
    if (data.length === 0) return [];
    const filteredForCharts = data.filter(item => String(item.STATUS || "").toUpperCase().trim() !== "CANCELADO");
    const statsByDate = {};

    filteredForCharts.forEach(item => {
      const entryDate = safeGetISODate(item.DATA_ENTRADA);
      const separationDate = safeGetISODate(item.DATA_SEPARACAO);
      const status = String(item.STATUS || "").toUpperCase().trim();
      if (entryDate) {
        if (!statsByDate[entryDate]) statsByDate[entryDate] = { date: entryDate, entradas: 0, separacoes: 0, leadTimes: [] };
        statsByDate[entryDate].entradas += 1;
      }
      if (separationDate) {
        if (!statsByDate[separationDate]) statsByDate[separationDate] = { date: separationDate, entradas: 0, separacoes: 0, leadTimes: [] };
        statsByDate[separationDate].separacoes += 1;
        if (status === "EXPEDIDO" && entryDate) {
          const start = new Date(entryDate);
          const end = new Date(separationDate);
          const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0) statsByDate[separationDate].leadTimes.push(diffDays);
        }
      }
    });

    const sortedDates = Object.values(statsByDate).sort((a, b) => new Date(a.date) - new Date(b.date));
    const calculateSimpleMA = (arr, index, period, key) => {
      if (index < period - 1) return null;
      let sum = 0;
      for (let i = 0; i < period; i++) sum += (arr[index - i][key] || 0);
      return parseFloat((sum / period).toFixed(2));
    };

    return sortedDates.map((day, idx) => {
      const dailyLeadAvg = day.leadTimes.length ? day.leadTimes.reduce((a, b) => a + b, 0) / day.leadTimes.length : 0;

      let sumLead7 = 0, countLead7 = 0;
      for (let i = 0; i < 7 && (idx - i) >= 0; i++) {
        const val = sortedDates[idx - i].leadTimes.length ? sortedDates[idx - i].leadTimes.reduce((a, b) => a + b, 0) / sortedDates[idx - i].leadTimes.length : 0;
        if (val > 0) { sumLead7 += val; countLead7++; }
      }
      const leadTimeMa7 = countLead7 > 0 ? sumLead7 / countLead7 : null;

      return {
        ...day,
        ma7_entradas: calculateSimpleMA(sortedDates, idx, 7, 'entradas'),
        ma7_separacoes: calculateSimpleMA(sortedDates, idx, 7, 'separacoes'),
        leadTimeDaily: parseFloat(dailyLeadAvg.toFixed(2)),
        leadTimeMa7: leadTimeMa7 ? parseFloat(leadTimeMa7.toFixed(2)) : null,
        channelLower: leadTimeMa7 ? Math.max(0, leadTimeMa7 * 0.8) : 0,
        channelHeight: leadTimeMa7 ? leadTimeMa7 * 0.4 : 0
      };
    });
  }, [data]);

  // Sempre que chartData mudar (novos dados syncados), resetamos o filtro visível para mostrar tudo
  useEffect(() => {
    setVisibleRange(null);
  }, [chartData]);

  const visibleRangeData = useMemo(() => {
    if (!chartData.length) return [];
    if (!visibleRange) return chartData; // Retorna tudo se não houver filtro ativo
    return chartData.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [chartData, visibleRange]);

  const selectionSummary = useMemo(() => {
    if (chartData.length === 0) return null;
    const startIndex = visibleRange ? visibleRange.startIndex : 0;
    const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;
    const viewSlice = chartData.slice(startIndex, endIndex + 1);

    const entradas = viewSlice.reduce((acc, curr) => acc + (curr.entradas || 0), 0);
    const separacoes = viewSlice.reduce((acc, curr) => acc + (curr.separacoes || 0), 0);
    const validDaysSlice = viewSlice.filter(d => d.leadTimeDaily > 0);
    const avgLead = validDaysSlice.length ? (validDaysSlice.reduce((acc, c) => acc + c.leadTimeDaily, 0) / validDaysSlice.length).toFixed(1) : 0;
    return { entradas, separacoes, balanco: separacoes - entradas, numDias: viewSlice.length, mediaEntradasPeriodo: (entradas / viewSlice.length).toFixed(2), mediaSeparacoesPeriodo: (separacoes / viewSlice.length).toFixed(2), avgLeadTimePeriodo: avgLead };
  }, [chartData, visibleRange]);

  const slaAnalysis = useMemo(() => {
    if (data.length === 0 || chartData.length === 0) return { taxaNoPrazo: 0 };
    const startIndex = visibleRange ? visibleRange.startIndex : 0;
    const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;

    const startDate = new Date(chartData[startIndex]?.date);
    const endDate = new Date(chartData[endIndex]?.date);

    let expedidosTotal = 0;
    let expedidosNoPrazo = 0;
    const metaSlaDias = 20;

    data.forEach(item => {
      const sepDateStr = safeGetISODate(item.DATA_SEPARACAO);
      const entryDateStr = safeGetISODate(item.DATA_ENTRADA);
      const status = String(item.STATUS || "").toUpperCase().trim();

      if (status === "EXPEDIDO" && sepDateStr && entryDateStr) {
        const sepDate = new Date(sepDateStr);
        if (sepDate >= startDate && sepDate <= endDate) {
          expedidosTotal++;
          const entryDate = new Date(entryDateStr);
          const diffDays = Math.ceil((sepDate - entryDate) / (1000 * 60 * 60 * 24));
          if (diffDays <= metaSlaDias) expedidosNoPrazo++;
        }
      }
    });

    const taxa = expedidosTotal > 0 ? ((expedidosNoPrazo / expedidosTotal) * 100).toFixed(1) : 0;
    return { taxaNoPrazo: taxa };
  }, [data, chartData, visibleRange]);

  const dynamicAnalysis = useMemo(() => {
    if (data.length === 0 || chartData.length === 0) return { monthly: [], piStats: { delivered: 0, cancelled: 0, totalUnique: 0 } };
    const startIndex = visibleRange ? visibleRange.startIndex : 0;
    const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;
    const startDate = new Date(chartData[startIndex]?.date);
    const endDate = new Date(chartData[endIndex]?.date);

    const filteredRaw = data.filter(item => {
      const d = safeGetISODate(item.DATA_ENTRADA);
      if (!d) return false;
      const itemDate = new Date(d);
      return itemDate >= startDate && itemDate <= endDate;
    });
    const months = {};
    const piDelivered = new Set();
    const piCancelled = new Set();
    filteredRaw.forEach(item => {
      const dateStr = safeGetISODate(item.DATA_ENTRADA);
      const monthKey = dateStr.substring(0, 7);
      const status = String(item.STATUS || "").toUpperCase().trim();
      const pi = item.PI;
      if (!months[monthKey]) months[monthKey] = { month: monthKey, liberados: 0, cancelados: 0 };
      if (status === "CANCELADO") {
        months[monthKey].cancelados += 1;
        if (pi) piCancelled.add(pi);
      } else {
        months[monthKey].liberados += 1;
        if (status === "EXPEDIDO" && pi) piDelivered.add(pi);
      }
    });
    return {
      monthly: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)),
      piStats: { delivered: piDelivered.size, cancelled: piCancelled.size, totalUnique: new Set([...piDelivered, ...piCancelled]).size }
    };
  }, [data, chartData, visibleRange]);

  // Compara o período selecionado com o período imediatamente anterior de
  // mesma duração (ex: últimos 30 dias vs os 30 dias antes deles), para dar
  // contexto de tendência aos KPIs (subiu/caiu e quanto).
  const periodComparison = useMemo(() => {
    if (chartData.length === 0) return null;
    const startIndex = visibleRange ? visibleRange.startIndex : 0;
    const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;
    const windowSize = endIndex - startIndex + 1;

    const prevEndIndex = startIndex - 1;
    const prevStartIndex = prevEndIndex - windowSize + 1;
    if (prevStartIndex < 0) return null; // não há histórico suficiente antes do período atual

    const summarize = (fromIdx, toIdx) => {
      const slice = chartData.slice(fromIdx, toIdx + 1);
      const entradas = slice.reduce((acc, curr) => acc + (curr.entradas || 0), 0);
      const separacoes = slice.reduce((acc, curr) => acc + (curr.separacoes || 0), 0);
      const validDays = slice.filter(d => d.leadTimeDaily > 0);
      const avgLeadTime = validDays.length ? validDays.reduce((acc, c) => acc + c.leadTimeDaily, 0) / validDays.length : 0;

      const startDate = new Date(chartData[fromIdx]?.date);
      const endDate = new Date(chartData[toIdx]?.date);
      let expedidosTotal = 0, expedidosNoPrazo = 0;
      const metaSlaDias = 20;
      data.forEach(item => {
        const sepDateStr = safeGetISODate(item.DATA_SEPARACAO);
        const entryDateStr = safeGetISODate(item.DATA_ENTRADA);
        const status = String(item.STATUS || "").toUpperCase().trim();
        if (status === "EXPEDIDO" && sepDateStr && entryDateStr) {
          const sepDate = new Date(sepDateStr);
          if (sepDate >= startDate && sepDate <= endDate) {
            expedidosTotal++;
            const diffDays = Math.ceil((sepDate - new Date(entryDateStr)) / (1000 * 60 * 60 * 24));
            if (diffDays <= metaSlaDias) expedidosNoPrazo++;
          }
        }
      });
      const slaRate = expedidosTotal > 0 ? (expedidosNoPrazo / expedidosTotal) * 100 : 0;

      return { entradas, separacoes, balanco: separacoes - entradas, avgLeadTime, slaRate };
    };

    const current = summarize(startIndex, endIndex);
    const previous = summarize(prevStartIndex, prevEndIndex);

    const pctChange = (curr, prev) => {
      if (prev === 0) return curr === 0 ? 0 : null; // sem base de comparação (divisão por zero)
      return ((curr - prev) / Math.abs(prev)) * 100;
    };

    return {
      current, previous,
      deltas: {
        entradas: pctChange(current.entradas, previous.entradas),
        separacoes: pctChange(current.separacoes, previous.separacoes),
        avgLeadTime: pctChange(current.avgLeadTime, previous.avgLeadTime),
        slaRate: current.slaRate - previous.slaRate // diferença em pontos percentuais, não %
      }
    };
  }, [data, chartData, visibleRange]);

  return {
    chartData, visibleRange, setVisibleRange, visibleRangeData,
    selectionSummary, slaAnalysis, dynamicAnalysis, periodComparison
  };
};
