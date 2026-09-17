import { useMemo, useState } from 'react';
import { safeGetISODate } from '../utils/dates';

// Fila de pedidos pendentes (backlog): filtros por tipo/data, aging por
// faixas, cruzamento com o status no SINGRA e o top 10 mais críticos.
export const useBacklogAnalysis = (data, singraData) => {
  const [backlogStartDate, setBacklogStartDate] = useState("");
  const [backlogEndDate, setBacklogEndDate] = useState("");
  const [backlogTypeFilter, setBacklogTypeFilter] = useState("TODOS");

  const backlogAnalysis = useMemo(() => {
    if (data.length === 0) return null;
    const today = new Date();

    const filteredData = data.filter(item => {
      // 1. FILTRO DE TIPO RM
      if (backlogTypeFilter !== "TODOS") {
        const tipo = String(item.TIPO_RM || "").toUpperCase().trim();
        if (tipo !== backlogTypeFilter) return false;
      }

      // 2. Filtro de Datas
      const entryDateIso = safeGetISODate(item.DATA_ENTRADA);
      if (!entryDateIso) return true;
      const itemDate = new Date(entryDateIso);

      if (backlogStartDate && itemDate < new Date(backlogStartDate)) return false;
      if (backlogEndDate) {
        const endLimit = new Date(backlogEndDate);
        endLimit.setHours(23, 59, 59, 999);
        if (itemDate > endLimit) return false;
      }
      return true;
    });

    const pendingOrders = filteredData.filter(item => {
      const status = String(item.STATUS || "").toUpperCase().trim();
      return status !== "EXPEDIDO" && status !== "CANCELADO";
    });

    // NOVO: Criar mapa do Singra para cruzamento rápido da fila
    const singraMap = {};
    singraData.forEach(item => {
      const p = String(item.ID || item.PEDIDO || item.RM || item.DOCUMENTO).replace(/^0+/, '').trim().toUpperCase();
      if (p) singraMap[p] = item;
    });

    const singraStatusSummary = {}; // NOVO: Objeto que vai contar as ocorrências

    const pendingWithAge = pendingOrders.map(item => {
      const entryDateIso = safeGetISODate(item.DATA_ENTRADA);
      let daysOpen = 0;
      if (entryDateIso) {
        const entry = new Date(entryDateIso);
        daysOpen = Math.floor((today - entry) / (1000 * 60 * 60 * 24));
      }

      // NOVO: Cruza a RM na fila com o status atual dela no SINGRA
      const pedidoBusca = String(item.PEDIDO || item.RM || "").replace(/^0+/, '').trim().toUpperCase();
      const singraItem = singraMap[pedidoBusca];
      const singraStatusRaw = singraItem ? (singraItem.SITUACAO || singraItem.STATUS) : "NÃO CONSTA";
      const singraStatus = String(singraStatusRaw || "NÃO CONSTA").toUpperCase().trim();

      // Conta a ocorrência deste status
      singraStatusSummary[singraStatus] = (singraStatusSummary[singraStatus] || 0) + 1;

      return { ...item, daysOpen, entryDateIso, singraStatus };
    }).sort((a, b) => b.daysOpen - a.daysOpen);

    const buckets = [
      { name: '0-3 Dias', min: 0, max: 3, total: 0 },
      { name: '4-7 Dias', min: 4, max: 7, total: 0 },
      { name: '8-14 Dias', min: 8, max: 14, total: 0 },
      { name: '15-30 Dias', min: 15, max: 30, total: 0 },
      { name: '30+ Dias', min: 31, max: 99999, total: 0 }
    ];

    const uniqueStatusesSet = new Set();
    pendingWithAge.forEach(order => {
      const bucket = buckets.find(b => order.daysOpen >= b.min && order.daysOpen <= b.max);
      if (bucket) {
        bucket.total++;
        const status = String(order.STATUS || "N/A").toUpperCase().trim();
        bucket[status] = (bucket[status] || 0) + 1;
        uniqueStatusesSet.add(status);
      }
    });

    const totalPending = pendingWithAge.length;
    const avgAge = totalPending > 0 ? (pendingWithAge.reduce((acc, curr) => acc + curr.daysOpen, 0) / totalPending).toFixed(1) : 0;
    const oldestOrder = totalPending > 0 ? pendingWithAge[0] : null;
    const statusDist = {};
    pendingWithAge.forEach(order => {
      const st = String(order.STATUS || "N/A").toUpperCase().trim();
      statusDist[st] = (statusDist[st] || 0) + 1;
    });
    const statusChartData = Object.entries(statusDist).map(([name, value]) => ({ name, value }));

    const uniqueStatuses = Array.from(uniqueStatusesSet).sort();

    return {
      pendingOrders: pendingWithAge, buckets, totalPending, avgAge, oldestOrder, statusChartData,
      topOffenders: pendingWithAge.slice(0, 10), uniqueStatuses, singraStatusSummary // Exporta o resumo do Singra
    };
  // ATENÇÃO: Adicionado 'singraData' nas dependências
  }, [data, singraData, backlogStartDate, backlogEndDate, backlogTypeFilter]);

  return {
    backlogAnalysis,
    backlogStartDate, setBacklogStartDate,
    backlogEndDate, setBacklogEndDate,
    backlogTypeFilter, setBacklogTypeFilter
  };
};
