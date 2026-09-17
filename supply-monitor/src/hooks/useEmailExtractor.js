import { useMemo, useState } from 'react';
import { safeGetISODate } from '../utils/dates';

// Extrai RMs coladas em um texto (e-mail/mensagem) e cruza com WMS + SINGRA.
export const useEmailExtractor = (data, singraData) => {
  const [emailText, setEmailText] = useState("");

  const [savedSearches, setSavedSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('supplySavedSearches');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [newSearchName, setNewSearchName] = useState("");

  const handleSaveSearch = () => {
    if (!emailText.trim() || !newSearchName.trim()) return;
    const newSearch = { id: Date.now(), name: newSearchName, text: emailText };
    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    localStorage.setItem('supplySavedSearches', JSON.stringify(updated));
    setNewSearchName("");
  };

  const handleDeleteSearch = (id) => {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    localStorage.setItem('supplySavedSearches', JSON.stringify(updated));
  };

  // extractedOrders é inteiramente derivado de emailText/data/singraData, então
  // calculamos com useMemo em vez de useState+useEffect (evita um render extra
  // e o anti-padrão de setState síncrono dentro de efeito).
  const extractedOrders = useMemo(() => {
    if (!emailText || data.length === 0) return [];

    // Regex para buscar padrões como 12.345.678 ou 12345678
    const regex = /\b(\d{2}\.\d{3}\.\d{3}|\d{8})\b/g;
    const matches = emailText.match(regex) || [];

    // Remove duplicatas e tira os pontos para padronizar
    const uniqueCleanIds = [...new Set(matches.map(m => m.replace(/\./g, '')))];

    // Cria um mapa rápido do Singra
    const singraMap = {};
    singraData.forEach(item => {
      const p = String(item.ID || item.PEDIDO || item.RM || item.DOCUMENTO).replace(/^0+/, '').trim().toUpperCase();
      if (p) singraMap[p] = item;
    });

    // Cruza os IDs encontrados com o WMS e o SINGRA
    return uniqueCleanIds.map(id => {
      const idBusca = id.replace(/^0+/, '').toUpperCase();
      const wmsItem = data.find(d => String(d.PEDIDO || d.RM || "").trim().replace(/^0+/, '').toUpperCase() === idBusca);
      const singraItem = singraMap[idBusca];

      return {
        cam: wmsItem && wmsItem.CAM ? wmsItem.CAM : "-",
        idOriginal: id, // Representa a RM Extraída
        capa: wmsItem && wmsItem.CAPA ? wmsItem.CAPA : "-", // NOVA COLUNA CAPA
        stc: wmsItem && wmsItem.STC ? wmsItem.STC : "-",
        wmsStatus: wmsItem ? wmsItem.STATUS : "NÃO LOCALIZADO",
        singraStatus: singraItem ? (singraItem.SITUACAO || singraItem.STATUS) : "NÃO CONSTA",
        dataEntrada: wmsItem && wmsItem.DATA_ENTRADA ? safeGetISODate(wmsItem.DATA_ENTRADA) : null,
        dataSeparacao: wmsItem && wmsItem.DATA_SEPARACAO ? safeGetISODate(wmsItem.DATA_SEPARACAO) : null,
        lote: wmsItem && wmsItem.LOTE ? wmsItem.LOTE : "-" // NOVA COLUNA LOTE
      };
    });
  }, [emailText, data, singraData]);

  const emailResultsSummary = useMemo(() => {
    const summary = {};
    extractedOrders.forEach(order => {
      const status = order.wmsStatus || "NÃO LOCALIZADO";
      summary[status] = (summary[status] || 0) + 1;
    });
    return Object.entries(summary);
  }, [extractedOrders]);

  return {
    emailText, setEmailText, extractedOrders, emailResultsSummary,
    savedSearches, newSearchName, setNewSearchName,
    handleSaveSearch, handleDeleteSearch
  };
};
