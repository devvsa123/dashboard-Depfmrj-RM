import { useMemo, useState } from 'react';
import { safeGetISODate } from '../utils/dates';
import { metaSlaDiasDoPedido } from './useStcGtcAnalysis';
import { parseNomenclatura, classificarAbc } from '../utils/nomenclatura';

// Análise por item. Como são milhares de nomenclaturas distintas, olhar
// item a item não ajuda ninguém — o valor está em agrupar e deixar a curva
// ABC mostrar quais poucos grupos explicam a maior parte do movimento.
// Três níveis de agrupamento (ver utils/nomenclatura.js):
//   Família — a peça (CALCA, GANDOLA, SAPATO...)
//   Linha   — o modelo, juntando peças do mesmo conjunto
//   Grade   — o item, juntando os tamanhos
export const NIVEIS = [
  { key: 'familia', label: 'Família', descricao: 'A peça em si — CALCA, SAPATO, GANDOLA...' },
  { key: 'linha', label: 'Linha / Conjunto', descricao: 'O modelo, juntando as peças do mesmo conjunto' },
  { key: 'grade', label: 'Grade', descricao: 'O item, juntando todos os tamanhos' }
];

export const useItemAnalysis = (data, chartData, visibleRange) => {
  const [nivel, setNivel] = useState('familia');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('entradas');
  const [sortDir, setSortDir] = useState('desc');

  const itemAnalysis = useMemo(() => {
    if (!data.length) return { rows: [], hasData: false, totalNomenclaturas: 0 };

    const startIndex = chartData.length ? (visibleRange ? visibleRange.startIndex : 0) : null;
    const endIndex = chartData.length ? (visibleRange ? visibleRange.endIndex : chartData.length - 1) : null;
    const startDate = startIndex !== null ? new Date(chartData[startIndex]?.date) : null;
    const endDate = endIndex !== null ? new Date(chartData[endIndex]?.date) : null;
    const today = new Date();

    const porGrupo = new Map();
    const nomesDistintos = new Set();

    const getBucket = (chave) => {
      if (!porGrupo.has(chave)) {
        porGrupo.set(chave, {
          chave, entradas: 0, cancelados: 0, leadTimes: [], onTime: 0,
          pendentes: 0, pendentesAges: [], openPedidos: [],
          nomes: new Set(), composicao: new Map()
        });
      }
      return porGrupo.get(chave);
    };

    // O nível seguinte, usado no detalhamento: família abre em linhas,
    // linha abre em grades, grade abre em tamanhos.
    const NIVEL_FILHO = { familia: 'linha', linha: 'grade', grade: 'tamanho' };
    const nivelFilho = NIVEL_FILHO[nivel];

    data.forEach(item => {
      const parsed = parseNomenclatura(item.NOMENCLATURA);
      const chave = parsed[nivel];
      const bucket = getBucket(chave);
      const status = String(item.STATUS || '').toUpperCase().trim();

      nomesDistintos.add(parsed.nome);
      bucket.nomes.add(parsed.nome);

      const entryStr = safeGetISODate(item.DATA_ENTRADA);
      const entryInPeriod = Boolean(entryStr && startDate && endDate
        && new Date(entryStr) >= startDate && new Date(entryStr) <= endDate);

      if (status === 'CANCELADO') {
        if (entryInPeriod) bucket.cancelados++;
        return;
      }

      if (entryInPeriod) {
        bucket.entradas++;
        const filho = parsed[nivelFilho];
        bucket.composicao.set(filho, (bucket.composicao.get(filho) || 0) + 1);
      }

      if (status === 'EXPEDIDO') {
        const sepStr = safeGetISODate(item.DATA_SEPARACAO);
        if (entryStr && sepStr) {
          const sepDate = new Date(sepStr);
          const withinPeriod = !startDate || (sepDate >= startDate && sepDate <= endDate);
          if (withinPeriod) {
            const diffDays = Math.ceil((sepDate - new Date(entryStr)) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0) {
              bucket.leadTimes.push(diffDays);
              if (diffDays <= metaSlaDiasDoPedido(item)) bucket.onTime++;
            }
          }
        }
      } else {
        // Fila em aberto: situação atual, não filtrada pelo período — a
        // mesma convenção do resto do app.
        bucket.pendentes++;
        const daysOpen = entryStr ? Math.floor((today - new Date(entryStr)) / (1000 * 60 * 60 * 24)) : null;
        if (daysOpen !== null) bucket.pendentesAges.push(daysOpen);
        bucket.openPedidos.push({ ...item, status, daysOpen, nomenclatura: parsed.nome, subgrupo: parsed[nivelFilho] });
      }
    });

    const base = Array.from(porGrupo.values()).map(b => ({
      chave: b.chave,
      nomenclaturas: b.nomes.size,
      entradas: b.entradas,
      expedidos: b.leadTimes.length,
      avgLeadTime: b.leadTimes.length
        ? parseFloat((b.leadTimes.reduce((a, c) => a + c, 0) / b.leadTimes.length).toFixed(1)) : null,
      slaRate: b.leadTimes.length
        ? parseFloat(((b.onTime / b.leadTimes.length) * 100).toFixed(1)) : null,
      pendentes: b.pendentes,
      avgAgePendentes: b.pendentesAges.length
        ? parseFloat((b.pendentesAges.reduce((a, c) => a + c, 0) / b.pendentesAges.length).toFixed(1)) : null,
      oldestPendente: b.pendentesAges.length ? Math.max(...b.pendentesAges) : null,
      cancelados: b.cancelados,
      openPedidos: b.openPedidos,
      composicao: Array.from(b.composicao.entries())
        .map(([nome, qtd]) => ({ nome, qtd }))
        .sort((a, c) => c.qtd - a.qtd)
    }));

    const rows = classificarAbc(base, 'entradas');
    return { rows, hasData: rows.length > 0, totalNomenclaturas: nomesDistintos.size, nivelFilho };
  }, [data, chartData, visibleRange, nivel]);

  const filteredSortedRows = useMemo(() => {
    const term = search.trim().toUpperCase();
    let rows = term ? itemAnalysis.rows.filter(r => r.chave.includes(term)) : itemAnalysis.rows;
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [itemAnalysis.rows, search, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const summary = useMemo(() => {
    const rows = itemAnalysis.rows;
    if (!rows.length) return null;
    const classeA = rows.filter(r => r.classeAbc === 'A');
    const comSla = rows.filter(r => r.slaRate !== null && r.expedidos >= 5);
    const piores = [...comSla].sort((a, b) => a.slaRate - b.slaRate);
    return {
      totalGrupos: rows.length,
      totalNomenclaturas: itemAnalysis.totalNomenclaturas,
      classeACount: classeA.length,
      classeAShare: parseFloat(classeA.reduce((acc, r) => acc + r.participacao, 0).toFixed(1)),
      totalPendentes: rows.reduce((acc, r) => acc + r.pendentes, 0),
      piorSla: piores[0] || null,
      maiorFila: [...rows].sort((a, b) => b.pendentes - a.pendentes)[0] || null
    };
  }, [itemAnalysis]);

  return {
    itemAnalysis, rows: filteredSortedRows, summary,
    nivel, setNivel, search, setSearch, sortKey, sortDir, toggleSort
  };
};
