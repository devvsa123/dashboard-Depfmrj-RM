import { useMemo } from 'react';
import { safeGetISODate } from '../utils/dates';
import { metaSlaDiasDoPedido } from './useStcGtcAnalysis';

const TYPES = ["RMT", "RMC"];

const average = (arr) => arr.length ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;

// Compara o desempenho de RMT x RMC (os dois tipos de requisição de
// material) dentro do período selecionado: volume de entrada, tempo médio
// de atendimento e nível de serviço de cada tipo, lado a lado.
export const useRmTypeComparison = (data, chartData, visibleRange) => {
  return useMemo(() => {
    if (!data.length || !chartData.length) return { groups: [], hasData: false };

    const startIndex = visibleRange ? visibleRange.startIndex : 0;
    const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;
    const startDate = new Date(chartData[startIndex]?.date);
    const endDate = new Date(chartData[endIndex]?.date);

    const groups = TYPES.map(type => {
      let entradas = 0, expedidos = 0, noPrazo = 0;
      const leadTimes = [];

      data.forEach(item => {
        const tipo = String(item.TIPO_RM || "").toUpperCase().trim();
        if (tipo !== type) return;
        const status = String(item.STATUS || "").toUpperCase().trim();
        const entryStr = safeGetISODate(item.DATA_ENTRADA);

        if (entryStr && status !== "CANCELADO") {
          const entryDate = new Date(entryStr);
          if (entryDate >= startDate && entryDate <= endDate) entradas++;
        }

        if (status === "EXPEDIDO" && entryStr) {
          const sepStr = safeGetISODate(item.DATA_SEPARACAO);
          if (!sepStr) return;
          const sepDate = new Date(sepStr);
          if (sepDate < startDate || sepDate > endDate) return;
          const diffDays = Math.ceil((sepDate - new Date(entryStr)) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) return;
          expedidos++;
          leadTimes.push(diffDays);
          // Cada pedido é cobrado no prazo do documento dele (STC/GTC) —
          // o mesmo critério do SLA por tipo de documento nas Metas.
          if (diffDays <= metaSlaDiasDoPedido(item)) noPrazo++;
        }
      });

      return {
        type,
        entradas,
        expedidos,
        avgLeadTime: average(leadTimes),
        slaRate: expedidos > 0 ? parseFloat(((noPrazo / expedidos) * 100).toFixed(1)) : null
      };
    });

    const totalEntradas = groups.reduce((acc, g) => acc + g.entradas, 0);
    groups.forEach(g => { g.share = totalEntradas > 0 ? parseFloat(((g.entradas / totalEntradas) * 100).toFixed(1)) : null; });

    return { groups, hasData: groups.some(g => g.entradas > 0 || g.expedidos > 0) };
  }, [data, chartData, visibleRange]);
};
