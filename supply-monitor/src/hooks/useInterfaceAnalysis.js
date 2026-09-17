import { useMemo, useState } from 'react';
import { safeGetISODate } from '../utils/dates';

// Cruza os status lógicos entre WMS e SINGRA para achar descasamentos,
// pedidos aguardando retirada/arrecadação e falhas de interface.
export const useInterfaceAnalysis = (data, singraData) => {
  const [activeInterfaceView, setActiveInterfaceView] = useState("falhasInterface");
  const [selectedErrorFilter, setSelectedErrorFilter] = useState(null);

  const [interfaceStartDate, setInterfaceStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
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

    return results;
  }, [data, singraData, interfaceStartDate, interfaceEndDate]);

  return {
    interfaceAnalysis,
    activeInterfaceView, setActiveInterfaceView,
    selectedErrorFilter, setSelectedErrorFilter,
    interfaceStartDate, setInterfaceStartDate,
    interfaceEndDate, setInterfaceEndDate
  };
};
