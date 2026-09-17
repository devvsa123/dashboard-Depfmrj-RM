import { useMemo, useState } from 'react';
import { safeGetISODate } from '../utils/dates';

// Agrega entradas/saídas por mês e ano para o gráfico de sazonalidade (YoY).
export const useYoyAnalysis = (data) => {
  const [selectedYoyYears, setSelectedYoyYears] = useState([]);
  const [yoyMetrics, setYoyMetrics] = useState({ entradas: true, saidas: true });

  const yoyAnalysis = useMemo(() => {
    if (data.length === 0) return { chartData: [], availableYears: [] };

    const filtered = data.filter(item => String(item.STATUS || "").toUpperCase().trim() !== "CANCELADO");
    const yearSet = new Set();

    // Inicializa os 12 meses
    const monthlyAgg = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(2000, i, 1);
      return {
        monthIndex: i + 1,
        monthName: date.toLocaleString('pt-BR', { month: 'short' }).toUpperCase()
      };
    });

    filtered.forEach(item => {
      const entryDate = safeGetISODate(item.DATA_ENTRADA);
      const separationDate = safeGetISODate(item.DATA_SEPARACAO);
      const status = String(item.STATUS || "").toUpperCase().trim();

      // Entradas (Liberação)
      if (entryDate) {
        const [y, m] = entryDate.split('-');
        const year = parseInt(y, 10);
        const monthIdx = parseInt(m, 10) - 1;
        if (year >= 2020) {
          yearSet.add(year);
          monthlyAgg[monthIdx][`${year}_entradas`] = (monthlyAgg[monthIdx][`${year}_entradas`] || 0) + 1;
        }
      }

      // Saídas (Expedição)
      if (separationDate && status === "EXPEDIDO") {
        const [y, m] = separationDate.split('-');
        const year = parseInt(y, 10);
        const monthIdx = parseInt(m, 10) - 1;
        if (year >= 2020) {
          yearSet.add(year);
          monthlyAgg[monthIdx][`${year}_saidas`] = (monthlyAgg[monthIdx][`${year}_saidas`] || 0) + 1;
        }
      }
    });

    const availableYears = Array.from(yearSet).sort((a, b) => b - a); // Ordena decrescente
    return { chartData: monthlyAgg, availableYears };
  }, [data]);

  // Enquanto o usuário não escolher nada explicitamente, exibimos os dois
  // anos mais recentes por padrão — derivado direto do memo acima, sem
  // precisar de um efeito para "inicializar" o estado.
  const effectiveSelectedYoyYears = selectedYoyYears.length > 0
    ? selectedYoyYears
    : yoyAnalysis.availableYears.slice(0, 2);

  const toggleYoyYear = (year) => {
    setSelectedYoyYears(prev => {
      const base = prev.length > 0 ? prev : yoyAnalysis.availableYears.slice(0, 2);
      return base.includes(year) ? base.filter(y => y !== year) : [...base, year].sort((a, b) => b - a);
    });
  };

  return { yoyAnalysis, selectedYoyYears: effectiveSelectedYoyYears, toggleYoyYear, yoyMetrics, setYoyMetrics };
};
