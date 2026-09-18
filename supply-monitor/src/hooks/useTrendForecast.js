import { useMemo } from 'react';

const shiftYears = (iso, years) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
};

const daysInMonth = (year, month1indexed) => new Date(year, month1indexed, 0).getDate();

// Previsão do próximo mês para o gráfico "Entradas x Saídas ao Longo do
// Tempo", usando a mesma sazonalidade já disponível no gráfico de
// Sazonalidade: Comparativo Entre Anos (o que de fato aconteceu nesse mês
// em anos anteriores). Para cada dia do mês seguinte ao último dado real,
// faz a média histórica desse dia (mesmo mês/dia em anos anteriores) e
// ajusta pelo crescimento/queda recente deste ano vs. o mesmo período no
// ano passado — não é uma repetição cega do histórico, mas o padrão
// sazonal escalado ao nível atual da operação.
export const useTrendForecast = (chartData) => {
  return useMemo(() => {
    const empty = { forecastSeries: [], hasForecast: false, monthLabel: null, yearsUsed: 0 };
    if (chartData.length < 30) return empty;

    const lastEntry = chartData[chartData.length - 1];
    const [lastYearStr, lastMonthStr] = lastEntry.date.split('-');
    const lastYear = parseInt(lastYearStr, 10);
    const lastMonth = parseInt(lastMonthStr, 10); // 1-indexed
    const forecastYear = lastMonth === 12 ? lastYear + 1 : lastYear;
    const forecastMonth = lastMonth === 12 ? 1 : lastMonth + 1; // 1-indexed

    // Índice 'MM-DD' -> Map<ano, {entradas, separacoes}>
    const byMonthDay = new Map();
    chartData.forEach(d => {
      const [y, m, day] = d.date.split('-');
      const key = `${m}-${day}`;
      if (!byMonthDay.has(key)) byMonthDay.set(key, new Map());
      byMonthDay.get(key).set(parseInt(y, 10), { entradas: d.entradas || 0, separacoes: d.separacoes || 0 });
    });

    const nDays = daysInMonth(forecastYear, forecastMonth);
    const monthStr = String(forecastMonth).padStart(2, '0');

    const yearsWithData = new Set();
    for (let day = 1; day <= nDays; day++) {
      const key = `${monthStr}-${String(day).padStart(2, '0')}`;
      const yearMap = byMonthDay.get(key);
      if (yearMap) yearMap.forEach((_, y) => yearsWithData.add(y));
    }
    if (yearsWithData.size === 0) return empty;

    // Fator de ajuste: compara os últimos 30 dias reais com o mesmo
    // intervalo um ano antes, pra escalar a sazonalidade ao nível atual
    // da operação em vez de simplesmente repetir o ano passado.
    const recentWindow = chartData.slice(-30);
    let recentEntradas = 0, recentSeparacoes = 0, priorEntradas = 0, priorSeparacoes = 0, priorDaysFound = 0;
    recentWindow.forEach(d => {
      recentEntradas += d.entradas || 0;
      recentSeparacoes += d.separacoes || 0;
      const priorIso = shiftYears(d.date, -1);
      const [py, pm, pd] = priorIso.split('-');
      const priorVal = byMonthDay.get(`${pm}-${pd}`)?.get(parseInt(py, 10));
      if (priorVal) {
        priorEntradas += priorVal.entradas;
        priorSeparacoes += priorVal.separacoes;
        priorDaysFound++;
      }
    });

    const growthFactor = (recentVal, priorVal) => {
      if (priorDaysFound < 10 || priorVal <= 0) return 1; // sem base confiável -> usa a sazonalidade pura
      return Math.max(0.3, Math.min(recentVal / priorVal, 3)); // limita o ajuste pra não amplificar ruído
    };
    const growthEntradas = growthFactor(recentEntradas, priorEntradas);
    const growthSeparacoes = growthFactor(recentSeparacoes, priorSeparacoes);

    const forecastDays = [];
    for (let day = 1; day <= nDays; day++) {
      const key = `${monthStr}-${String(day).padStart(2, '0')}`;
      const historyValues = Array.from(byMonthDay.get(key)?.values() || []);
      if (!historyValues.length) continue;
      const avgEntradas = historyValues.reduce((a, v) => a + v.entradas, 0) / historyValues.length;
      const avgSeparacoes = historyValues.reduce((a, v) => a + v.separacoes, 0) / historyValues.length;
      forecastDays.push({
        date: `${forecastYear}-${monthStr}-${String(day).padStart(2, '0')}`,
        entradas_forecast: avgEntradas * growthEntradas,
        separacoes_forecast: avgSeparacoes * growthSeparacoes
      });
    }
    // Exige histórico pra pelo menos metade dos dias do mês — senão a
    // previsão fica cheia de buracos e não é confiável.
    if (forecastDays.length < nDays * 0.5) return empty;

    // Média móvel de 7 dias, igual ao resto do dashboard.
    const withMa7 = forecastDays.map((d, idx) => {
      let sumE = 0, sumS = 0, count = 0;
      for (let i = 0; i < 7 && (idx - i) >= 0; i++) {
        sumE += forecastDays[idx - i].entradas_forecast;
        sumS += forecastDays[idx - i].separacoes_forecast;
        count++;
      }
      return {
        date: d.date,
        ma7_entradas_forecast: parseFloat((sumE / count).toFixed(2)),
        ma7_saidas_forecast: parseFloat((sumS / count).toFixed(2))
      };
    });

    const monthLabel = new Date(forecastYear, forecastMonth - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return { forecastSeries: withMa7, hasForecast: true, monthLabel, yearsUsed: yearsWithData.size };
  }, [chartData]);
};
