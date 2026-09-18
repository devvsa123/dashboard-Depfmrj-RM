import { useMemo, useState } from 'react';
import { safeGetISODate } from '../utils/dates';
import { classifyStc } from './useStcGtcAnalysis';

const META_SLA_DIAS = 20;

// Análise por CAM (o recebedor/cliente de cada pedido): volume, tempo
// médio de atendimento, nível de serviço e fila em aberto, tudo agrupado
// por CAM em vez de por tipo de documento ou por RM. O período (entradas,
// expedidos, SLA) segue o mesmo período selecionado na aba Indicadores;
// a fila em aberto é sempre a situação atual, como no resto do app.
export const useCamAnalysis = (data, chartData, visibleRange) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('totalPedidos');
  const [sortDir, setSortDir] = useState('desc');

  const camAnalysis = useMemo(() => {
    if (!data.length) return { rows: [], hasData: false };

    const startIndex = chartData.length ? (visibleRange ? visibleRange.startIndex : 0) : null;
    const endIndex = chartData.length ? (visibleRange ? visibleRange.endIndex : chartData.length - 1) : null;
    const startDate = startIndex !== null ? new Date(chartData[startIndex]?.date) : null;
    const endDate = endIndex !== null ? new Date(chartData[endIndex]?.date) : null;
    const today = new Date();

    const byCam = new Map();
    const getBucket = (cam) => {
      if (!byCam.has(cam)) {
        byCam.set(cam, {
          cam, totalPedidos: 0, cancelados: 0, entradas: 0,
          leadTimes: [], onTime: 0, pendentes: 0, pendentesAges: [],
          stcSet: new Set(), gtcSet: new Set()
        });
      }
      return byCam.get(cam);
    };

    data.forEach(item => {
      const cam = String(item.CAM || '').trim() || 'Sem CAM';
      const bucket = getBucket(cam);
      const status = String(item.STATUS || '').toUpperCase().trim();
      bucket.totalPedidos++;

      const docType = classifyStc(item.STC);
      if (docType === 'STC') bucket.stcSet.add(String(item.STC).trim().toUpperCase());
      else if (docType === 'GTC') bucket.gtcSet.add(String(item.STC).trim().toUpperCase());

      if (status === 'CANCELADO') { bucket.cancelados++; return; }

      const entryStr = safeGetISODate(item.DATA_ENTRADA);
      if (entryStr && startDate && endDate) {
        const entryDate = new Date(entryStr);
        if (entryDate >= startDate && entryDate <= endDate) bucket.entradas++;
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
              if (diffDays <= META_SLA_DIAS) bucket.onTime++;
            }
          }
        }
      } else {
        // Pendente: situação atual, não filtrada pelo período selecionado
        // (mesma lógica usada no restante do app para "fila em aberto").
        bucket.pendentes++;
        if (entryStr) bucket.pendentesAges.push(Math.floor((today - new Date(entryStr)) / (1000 * 60 * 60 * 24)));
      }
    });

    const rows = Array.from(byCam.values()).map(b => ({
      cam: b.cam,
      totalPedidos: b.totalPedidos,
      cancelados: b.cancelados,
      entradas: b.entradas,
      expedidos: b.leadTimes.length,
      avgLeadTime: b.leadTimes.length ? parseFloat((b.leadTimes.reduce((a, c) => a + c, 0) / b.leadTimes.length).toFixed(1)) : null,
      slaRate: b.leadTimes.length ? parseFloat(((b.onTime / b.leadTimes.length) * 100).toFixed(1)) : null,
      pendentes: b.pendentes,
      avgAgePendentes: b.pendentesAges.length ? parseFloat((b.pendentesAges.reduce((a, c) => a + c, 0) / b.pendentesAges.length).toFixed(1)) : null,
      oldestPendente: b.pendentesAges.length ? Math.max(...b.pendentesAges) : null,
      stcCount: b.stcSet.size,
      gtcCount: b.gtcSet.size
    }));

    return { rows, hasData: rows.length > 0 };
  }, [data, chartData, visibleRange]);

  const filteredSortedRows = useMemo(() => {
    const term = search.trim().toUpperCase();
    let rows = term ? camAnalysis.rows.filter(r => r.cam.toUpperCase().includes(term)) : camAnalysis.rows;
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [camAnalysis.rows, search, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const summary = useMemo(() => {
    const rows = camAnalysis.rows;
    if (!rows.length) return null;
    const withSla = rows.filter(r => r.slaRate !== null);
    const totalEntradas = rows.reduce((acc, r) => acc + r.entradas, 0);
    const totalPendentes = rows.reduce((acc, r) => acc + r.pendentes, 0);
    const avgSla = withSla.length ? parseFloat((withSla.reduce((acc, r) => acc + r.slaRate, 0) / withSla.length).toFixed(1)) : null;
    const topVolume = [...rows].sort((a, b) => b.entradas - a.entradas)[0];
    const worstSla = withSla.length ? [...withSla].sort((a, b) => a.slaRate - b.slaRate)[0] : null;
    return { totalCams: rows.length, totalEntradas, totalPendentes, avgSla, topVolume, worstSla };
  }, [camAnalysis.rows]);

  return { camAnalysis, rows: filteredSortedRows, summary, search, setSearch, sortKey, sortDir, toggleSort };
};
