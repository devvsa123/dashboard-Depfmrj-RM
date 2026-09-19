import { useMemo, useState } from 'react';
import { safeGetISODate } from '../utils/dates';
import { classifyStc } from './useStcGtcAnalysis';

// Resume uma lista de pedidos sob a ótica de pedidos E de documentos
// (quantos STC/GTC distintos ela cobre) — a mesma distinção usada no
// cartão de STC/GTC: um documento agrupa vários pedidos.
const summarizeByDocument = (items) => {
  const stcSet = new Set();
  const gtcSet = new Set();
  const today = new Date();
  let totalAge = 0, countAge = 0, oldestDaysOpen = 0;

  items.forEach(item => {
    const type = classifyStc(item.STC);
    if (type) {
      const key = String(item.STC).trim().toUpperCase();
      (type === 'STC' ? stcSet : gtcSet).add(key);
    }
    const entryStr = safeGetISODate(item.DATA_ENTRADA);
    if (entryStr) {
      const days = Math.floor((today - new Date(entryStr)) / (1000 * 60 * 60 * 24));
      totalAge += days;
      countAge++;
      if (days > oldestDaysOpen) oldestDaysOpen = days;
    }
  });

  return {
    pedidoCount: items.length,
    stcCount: stcSet.size,
    gtcCount: gtcSet.size,
    avgDaysOpen: countAge ? parseFloat((totalAge / countAge).toFixed(1)) : 0,
    oldestDaysOpen
  };
};

// Agrupa uma lista de pedidos por mês de entrada, contando STC e GTC
// distintos em cada mês (mesma noção de "documento" do cartão de STC/GTC —
// um documento agrupa vários pedidos, então não dá pra simplesmente somar
// linhas da planilha).
const monthlyDocumentCountOf = (items) => {
  const months = {};
  items.forEach(item => {
    const entryStr = safeGetISODate(item.DATA_ENTRADA);
    if (!entryStr) return;
    const key = entryStr.substring(0, 7);
    if (!months[key]) months[key] = { stc: new Set(), gtc: new Set() };
    const type = classifyStc(item.STC);
    if (type) months[key][type === 'STC' ? 'stc' : 'gtc'].add(String(item.STC).trim().toUpperCase());
  });
  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, sets]) => ({ month, stc: sets.stc.size, gtc: sets.gtc.size }));
};

// Cruza os status lógicos entre WMS e SINGRA para achar descasamentos,
// pedidos aguardando retirada/arrecadação e falhas de interface.
export const useInterfaceAnalysis = (data, singraData) => {
  const [selectedErrorFilter, setSelectedErrorFilter] = useState(null);

  // Padrão de 12 meses: "Arrecadado pela OMS" é pensado como uma visão de
  // tendência mensal, não de recorte recente — 30 dias só mostrava o mês
  // corrente no gráfico.
  const [interfaceStartDate, setInterfaceStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 12);
    return d.toISOString().split('T')[0];
  });
  const [interfaceEndDate, setInterfaceEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const interfaceAnalysis = useMemo(() => {
    if (data.length === 0) return null;

    const singraMap = {};
    singraData.forEach(item => {
      const pedidoKey = item.ID || item.PEDIDO || item.RM || item.DOCUMENTO;
      if (pedidoKey) {
        const safeKey = String(pedidoKey).replace(/^0+/, '').trim().toUpperCase();
        singraMap[safeKey] = item;
      }
    });

    // NOVO: Criamos um "mapa de memória" do WMS para saber quem já foi checado
    const wmsMap = new Set();

    const results = {
      aguardandoRetirada: [],
      aguardandoArrecadacao: [],
      arrecadadoOms: [],
      falhasInterface: []
    };

    const normalizeString = (str) => String(str || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

    const startFilter = new Date(interfaceStartDate);
    startFilter.setHours(0, 0, 0, 0);
    const endFilter = new Date(interfaceEndDate);
    endFilter.setHours(23, 59, 59, 999);

    // 1ª ETAPA: Varredura Normal (WMS -> SINGRA)
    data.forEach(wmsItem => {
      const wmsStatusRaw = wmsItem.STATUS || "";
      const wStatus = normalizeString(wmsStatusRaw);

      if (wStatus === "CANCELADO") return;

      const pedidoOriginal = String(wmsItem.PEDIDO || wmsItem.RM || "").trim();
      const pedidoBusca = pedidoOriginal.replace(/^0+/, '').toUpperCase();

      // Salva na memória que essa RM existe no WMS
      wmsMap.add(pedidoBusca);

      const singraItem = singraMap[pedidoBusca];
      const sStatusRaw = singraItem ? (singraItem.SITUACAO || singraItem.STATUS) : "";
      const sStatus = normalizeString(sStatusRaw);

      const processedItem = { ...wmsItem, singraStatus: sStatusRaw || "NÃO CONSTA NO SINGRA" };

      if (!singraItem) {
        if (wStatus === "EXPEDIDO") {
          const entryStr = safeGetISODate(wmsItem.DATA_ENTRADA);
          if (entryStr) {
            const entryDate = new Date(entryStr);
            if (entryDate >= startFilter && entryDate <= endFilter) {
              results.arrecadadoOms.push(processedItem);
            }
          }
        } else {
          // NOVO: RM está no WMS (presa/em processo) e SUMIU do Singra
          results.falhasInterface.push(processedItem);
        }
        return;
      }

      if (singraItem) {
        if (sStatus === "EM TRANSITO" && wStatus === "CONFERIDO") {
          results.aguardandoRetirada.push(processedItem);
          return;
        }

        if (sStatus === "EM TRANSITO" && wStatus === "EXPEDIDO") {
          results.aguardandoArrecadacao.push(processedItem);
          return;
        }

        let isCasado = false;
        if (sStatus === "EM ATENDIMENTO" && (wStatus === "EM PLANEJAMENTO" || wStatus === "PLANEJAMENTO" || wStatus === "RESERVADO")) isCasado = true;
        else if (sStatus === "EM SEPARACAO" && (wStatus === "EM SEPARACAO" || wStatus === "SEPARACAO" || wStatus === "EM CONFERENCIA" || wStatus === "CONFERENCIA" || wStatus === "SEPARADO" || wStatus === "RESERVADO" || wStatus === "PLANEJAMENTO")) isCasado = true;
        else if (sStatus === "EM EXPEDICAO" && wStatus === "CONFERIDO") isCasado = true;
        else if (sStatus === "EM TRANSITO" && (wStatus === "CONFERIDO" || wStatus === "EXPEDIDO")) isCasado = true;

        if (!isCasado) {
          results.falhasInterface.push(processedItem);
        }
      }
    });

    // 2ª ETAPA: Varredura Reversa (SINGRA -> WMS)
    // O que está no SINGRA pendente e não desceu pro WMS?
    Object.values(singraMap).forEach(singraItem => {
      const pedidoKey = singraItem.ID || singraItem.PEDIDO || singraItem.RM || singraItem.DOCUMENTO;
      if (!pedidoKey) return;

      const safeKey = String(pedidoKey).replace(/^0+/, '').trim().toUpperCase();

      // Se essa RM NÃO foi vista durante o loop do WMS acima
      if (!wmsMap.has(safeKey)) {
        const sStatusRaw = singraItem.SITUACAO || singraItem.STATUS || "";
        const sStatus = normalizeString(sStatusRaw);

        // Se no Singra ela está como Finalizada/Cancelada a gente ignora para não poluir.
        // Focamos apenas nas que estão ATIVAS lá e sumidas no WMS:
        if (sStatus === "EM ATENDIMENTO" || sStatus === "EM SEPARACAO" || sStatus === "EM EXPEDICAO" || sStatus === "EM TRANSITO") {
          results.falhasInterface.push({
            PEDIDO: pedidoKey,
            PI: singraItem.PI || "-",
            STATUS: "NÃO CONSTA NO WMS", // Cria um alerta visual forte na coluna do WMS
            singraStatus: sStatusRaw,
            DATA_ENTRADA: singraItem.DATA_ENTRADA || singraItem.DATA_CADASTRO || null
          });
        }
      }
    });

    return {
      ...results,
      aguardandoRetiradaSummary: summarizeByDocument(results.aguardandoRetirada),
      aguardandoArrecadacaoSummary: summarizeByDocument(results.aguardandoArrecadacao),
      arrecadadoOmsSummary: { ...summarizeByDocument(results.arrecadadoOms), monthly: monthlyDocumentCountOf(results.arrecadadoOms) }
    };
  }, [data, singraData, interfaceStartDate, interfaceEndDate]);

  return {
    interfaceAnalysis,
    selectedErrorFilter, setSelectedErrorFilter,
    interfaceStartDate, setInterfaceStartDate,
    interfaceEndDate, setInterfaceEndDate
  };
};
