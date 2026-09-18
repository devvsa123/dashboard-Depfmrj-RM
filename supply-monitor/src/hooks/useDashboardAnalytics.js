import { useMemo, useState } from 'react';
import { safeGetISODate } from '../utils/dates';

const META_SLA_DIAS = 20;

const shiftDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const shiftYears = (iso, years) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
};

const getMonthRange = (iso, monthOffset) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(1);
  d.setMonth(d.getMonth() + monthOffset);
  const start = d.toISOString().split('T')[0];
  const endD = new Date(d);
  endD.setMonth(endD.getMonth() + 1);
  endD.setDate(0); // último dia do mês
  return { start, end: endD.toISOString().split('T')[0] };
};

const getYearRange = (iso, yearOffset) => {
  const y = parseInt(iso.split('-')[0], 10) + yearOffset;
  return { start: `${y}-01-01`, end: `${y}-12-31` };
};

// Períodos prontos, calculados a partir da data mais recente disponível nos
// dados (não da data real de hoje, já que a planilha pode estar defasada).
export const PERIOD_PRESETS = [
  { key: 'last7', label: '7 dias', range: (ref) => ({ start: shiftDays(ref, -6), end: ref }) },
  { key: 'last30', label: '30 dias', range: (ref) => ({ start: shiftDays(ref, -29), end: ref }) },
  { key: 'last90', label: '90 dias', range: (ref) => ({ start: shiftDays(ref, -89), end: ref }) },
  { key: 'thisMonth', label: 'Mês atual', range: (ref) => getMonthRange(ref, 0) },
  { key: 'lastMonth', label: 'Mês anterior', range: (ref) => getMonthRange(ref, -1) },
  { key: 'thisYear', label: 'Ano atual', range: (ref) => getYearRange(ref, 0) },
  { key: 'all', label: 'Tudo', range: (_, chartData) => ({ start: chartData[0].date, end: chartData[chartData.length - 1].date }) }
];

const firstIndexAtOrAfter = (chartData, iso) => {
  for (let i = 0; i < chartData.length; i++) if (chartData[i].date >= iso) return i;
  return -1;
};

const lastIndexAtOrBefore = (chartData, iso) => {
  for (let i = chartData.length - 1; i >= 0; i--) if (chartData[i].date <= iso) return i;
  return -1;
};

// Converte um par de datas em índices de chartData, usados internamente
// para fatiar a série. Retorna null se não houver nenhum dia dessa faixa
// nos dados (ex: um mês sem nenhum movimento).
const computeRangeIndices = (chartData, startIso, endIso) => {
  if (!chartData.length) return null;
  const startIndex = firstIndexAtOrAfter(chartData, startIso);
  const endIndex = lastIndexAtOrBefore(chartData, endIso);
  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) return null;
  return { startIndex, endIndex };
};

const computeSlaRate = (data, startDate, endDate) => {
  let expedidosTotal = 0, expedidosNoPrazo = 0;
  data.forEach(item => {
    const sepDateStr = safeGetISODate(item.DATA_SEPARACAO);
    const entryDateStr = safeGetISODate(item.DATA_ENTRADA);
    const status = String(item.STATUS || "").toUpperCase().trim();
    if (status === "EXPEDIDO" && sepDateStr && entryDateStr) {
      const sepDate = new Date(sepDateStr);
      if (sepDate >= startDate && sepDate <= endDate) {
        expedidosTotal++;
        const diffDays = Math.ceil((sepDate - new Date(entryDateStr)) / (1000 * 60 * 60 * 24));
        if (diffDays <= META_SLA_DIAS) expedidosNoPrazo++;
      }
    }
  });
  return expedidosTotal > 0 ? (expedidosNoPrazo / expedidosTotal) * 100 : 0;
};

// Acha o período de referência para comparação: o período anterior de
// mesma duração, ou o mesmo período um ano antes.
const computeComparisonIndices = (chartData, startIndex, endIndex, mode) => {
  if (mode === 'yearOverYear') {
    const startIso = shiftYears(chartData[startIndex].date, -1);
    const endIso = shiftYears(chartData[endIndex].date, -1);
    return computeRangeIndices(chartData, startIso, endIso);
  }
  const windowSize = endIndex - startIndex + 1;
  const prevEndIndex = startIndex - 1;
  const prevStartIndex = prevEndIndex - windowSize + 1;
  return prevStartIndex >= 0 ? { startIndex: prevStartIndex, endIndex: prevEndIndex } : null;
};

const summarizeWindow = (chartData, data, fromIdx, toIdx) => {
  const slice = chartData.slice(fromIdx, toIdx + 1);
  const entradas = slice.reduce((acc, curr) => acc + (curr.entradas || 0), 0);
  const separacoes = slice.reduce((acc, curr) => acc + (curr.separacoes || 0), 0);
  const validDays = slice.filter(d => d.leadTimeDaily > 0);
  const avgLeadTime = validDays.length ? validDays.reduce((acc, c) => acc + c.leadTimeDaily, 0) / validDays.length : 0;
  const slaRate = computeSlaRate(data, new Date(chartData[fromIdx]?.date), new Date(chartData[toIdx]?.date));
  return { entradas, separacoes, balanco: separacoes - entradas, avgLeadTime, slaRate };
};

// Série diária (entradas/saídas/lead time), a seleção de período (presets,
// intervalo customizado ou o Brush) e os indicadores agregados (SLA,
// balanço, cancelados x liberados, PIs) do período selecionado no dashboard.
export const useDashboardAnalytics = (data) => {
  // Correção de Inicialização: O estado default agora é `null` para assumir o tamanho completo dos dados
  const [visibleRangeRaw, setVisibleRangeRaw] = useState(null);
  // Qual preset está ativo (para destacar o botão certo); null quando o
  // período veio de um intervalo customizado ou do Brush arrastado à mão.
  const [activePresetKey, setActivePresetKey] = useState('all');
  // 'previous': período anterior de mesma duração. 'yearOverYear': mesmo
  // período no ano anterior. 'none': sem comparação.
  const [comparisonMode, setComparisonMode] = useState('previous');

  const visibleRange = visibleRangeRaw;
  const setVisibleRange = (range) => {
    setActivePresetKey(null);
    setVisibleRangeRaw(range);
  };

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

  // Sempre que chartData mudar (novos dados syncados), resetamos o filtro
  // visível para mostrar tudo. Ajustado durante a renderização (padrão
  // recomendado pelo React para "resetar estado quando uma prop muda"), em
  // vez de um useEffect, para não gerar uma re-renderização em cascata.
  const [lastChartData, setLastChartData] = useState(chartData);
  if (lastChartData !== chartData) {
    setLastChartData(chartData);
    setVisibleRangeRaw(null);
    setActivePresetKey('all');
  }

  const visibleRangeData = useMemo(() => {
    if (!chartData.length) return [];
    if (!visibleRange) return chartData; // Retorna tudo se não houver filtro ativo
    return chartData.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [chartData, visibleRange]);

  const selectedDateRange = useMemo(() => {
    if (!chartData.length) return null;
    const startIndex = visibleRange ? visibleRange.startIndex : 0;
    const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;
    return { startIndex, endIndex, startDate: chartData[startIndex].date, endDate: chartData[endIndex].date };
  }, [chartData, visibleRange]);

  // Aplica um período pronto (7/30/90 dias, mês atual, mês anterior, ano
  // atual ou tudo), calculado a partir do dia mais recente nos dados.
  const applyPreset = (key) => {
    if (!chartData.length) return;
    const preset = PERIOD_PRESETS.find(p => p.key === key);
    if (!preset) return;
    const ref = chartData[chartData.length - 1].date;
    const { start, end } = preset.range(ref, chartData);
    const indices = computeRangeIndices(chartData, start, end);
    setVisibleRangeRaw(indices);
    setActivePresetKey(key);
  };

  // Aplica um intervalo de datas escolhido manualmente pelo usuário.
  const applyCustomRange = (startIso, endIso) => {
    if (!chartData.length || !startIso || !endIso) return;
    setVisibleRangeRaw(computeRangeIndices(chartData, startIso, endIso));
    setActivePresetKey(null);
  };

  const selectionSummary = useMemo(() => {
    if (chartData.length === 0) return null;
    const startIndex = visibleRange ? visibleRange.startIndex : 0;
    const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;
    const { entradas, separacoes, balanco, avgLeadTime } = summarizeWindow(chartData, data, startIndex, endIndex);
    const numDias = endIndex - startIndex + 1;
    return {
      entradas, separacoes, balanco, numDias,
      mediaEntradasPeriodo: (entradas / numDias).toFixed(2),
      mediaSeparacoesPeriodo: (separacoes / numDias).toFixed(2),
      avgLeadTimePeriodo: avgLeadTime.toFixed(1)
    };
  }, [chartData, data, visibleRange]);

  const slaAnalysis = useMemo(() => {
    if (data.length === 0 || chartData.length === 0) return { taxaNoPrazo: 0 };
    const startIndex = visibleRange ? visibleRange.startIndex : 0;
    const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;
    const taxa = computeSlaRate(data, new Date(chartData[startIndex]?.date), new Date(chartData[endIndex]?.date));
    return { taxaNoPrazo: taxa.toFixed(1) };
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

  // Compara o período selecionado com um período de referência, escolhido
  // em `comparisonMode`: o período anterior de mesma duração, o mesmo
  // período um ano antes, ou nenhuma comparação.
  const periodComparison = useMemo(() => {
    if (chartData.length === 0 || comparisonMode === 'none') return null;
    const startIndex = visibleRange ? visibleRange.startIndex : 0;
    const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;

    const comparisonIndices = computeComparisonIndices(chartData, startIndex, endIndex, comparisonMode);
    if (!comparisonIndices) return null; // não há histórico suficiente para comparar

    const current = summarizeWindow(chartData, data, startIndex, endIndex);
    const previous = summarizeWindow(chartData, data, comparisonIndices.startIndex, comparisonIndices.endIndex);

    const pctChange = (curr, prev) => {
      if (prev === 0) return curr === 0 ? 0 : null; // sem base de comparação (divisão por zero)
      return ((curr - prev) / Math.abs(prev)) * 100;
    };

    return {
      current, previous,
      referenceDates: { startDate: chartData[comparisonIndices.startIndex].date, endDate: chartData[comparisonIndices.endIndex].date },
      deltas: {
        entradas: pctChange(current.entradas, previous.entradas),
        separacoes: pctChange(current.separacoes, previous.separacoes),
        avgLeadTime: pctChange(current.avgLeadTime, previous.avgLeadTime),
        slaRate: current.slaRate - previous.slaRate // diferença em pontos percentuais, não %
      }
    };
  }, [data, chartData, visibleRange, comparisonMode]);

  // Série dia-a-dia para sobrepor nos gráficos: o dia N do período
  // selecionado ao lado do dia N do período de referência (mesma posição
  // relativa, não a mesma data — por isso os dois períodos têm datas
  // diferentes, mas comparam "dia 1 com dia 1"). Sem isso, o modo de
  // comparação só mudava os selos de variação dos KPIs, sem nenhum efeito
  // visível nos gráficos de tendência.
  const comparisonSeries = useMemo(() => {
    if (chartData.length === 0 || comparisonMode === 'none') return null;
    const startIndex = visibleRange ? visibleRange.startIndex : 0;
    const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;

    const comparisonIndices = computeComparisonIndices(chartData, startIndex, endIndex, comparisonMode);
    if (!comparisonIndices) return null;

    const windowSize = Math.min(endIndex - startIndex + 1, comparisonIndices.endIndex - comparisonIndices.startIndex + 1);
    const series = [];
    for (let i = 0; i < windowSize; i++) {
      const current = chartData[startIndex + i];
      const reference = chartData[comparisonIndices.startIndex + i];
      series.push({
        ...current,
        cmp_date: reference.date,
        cmp_ma7_entradas: reference.ma7_entradas,
        cmp_ma7_separacoes: reference.ma7_separacoes,
        cmp_leadTimeMa7: reference.leadTimeMa7
      });
    }
    return series;
  }, [chartData, visibleRange, comparisonMode]);

  return {
    chartData, visibleRange, setVisibleRange, visibleRangeData, selectedDateRange,
    activePresetKey, applyPreset, applyCustomRange,
    comparisonMode, setComparisonMode,
    selectionSummary, slaAnalysis, dynamicAnalysis, periodComparison, comparisonSeries
  };
};
