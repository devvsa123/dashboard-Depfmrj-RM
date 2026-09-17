import { useState, useMemo, useEffect } from 'react';
import {
  Upload, Loader2, Activity, Clock, LayoutDashboard, Hourglass,
  RefreshCw, Network, Database, Search
} from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { XLSX_SCRIPT_URL, WMS_URL, SINGRA_URL } from './constants';
import { saveToCache, getFromCache } from './utils/cache';
import { safeGetISODate } from './utils/dates';
import { normalizeKeys, fetchSingraOnly } from './utils/spreadsheet';
import DashboardTab from './components/DashboardTab';
import BacklogTab from './components/BacklogTab';
import InterfaceTab from './components/InterfaceTab';
import EmailSearchTab from './components/EmailSearchTab';

const App = () => {
  const [data, setData] = useState([]);
  const [singraData, setSingraData] = useState([]); 
  const [emailText, setEmailText] = useState("");
  const [extractedOrders, setExtractedOrders] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [libLoaded, setLibLoaded] = useState(false);
  
  const [lastSync, setLastSync] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeInterfaceView, setActiveInterfaceView] = useState("falhasInterface");
  const [selectedErrorFilter, setSelectedErrorFilter] = useState(null); 

  const [selectedBucket, setSelectedBucket] = useState(null);
  const [selectedPiSegment, setSelectedPiSegment] = useState(null); 

  // Correção de Inicialização: O estado default agora é `null` para assumir o tamanho completo dos dados
  const [visibleRange, setVisibleRange] = useState(null);
  
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState("");
  const [bucketSearchTerm, setBucketSearchTerm] = useState("");

  const [interfaceStartDate, setInterfaceStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); 
    return d.toISOString().split('T')[0];
  });
  const [interfaceEndDate, setInterfaceEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [backlogStartDate, setBacklogStartDate] = useState("");
  const [backlogEndDate, setBacklogEndDate] = useState("");
  const [backlogTypeFilter, setBacklogTypeFilter] = useState("TODOS"); // NOVO ESTADO AQUI
  // --- INÍCIO DA LÓGICA DE SAZONALIDADE (YoY) ---
  const [selectedYoyYears, setSelectedYoyYears] = useState([]);
  const [yoyMetrics, setYoyMetrics] = useState({ entradas: true, saidas: true });
  // --- FIM DA LÓGICA DE SAZONALIDADE (YoY) ---





  // --- INÍCIO DA LÓGICA DE CONSULTAS SALVAS ---------------------------------------------------------------------------------------------------------------------------
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
  // --- FIM DA LÓGICA DE CONSULTAS SALVAS ---------------------------------------------------------------------------------------------------------------------------
















  

  useEffect(() => {
    if (window.XLSX) {
      setLibLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = XLSX_SCRIPT_URL;
    script.async = true;
    script.onload = () => setLibLoaded(true);
    script.onerror = () => setError("Erro ao carregar motor de Excel.");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (libLoaded && data.length === 0) {
      performSync(false);
    }
  }, [libLoaded]);

  useEffect(() => {
    if (!emailText || data.length === 0) {
      setExtractedOrders([]);
      return;
    }
    
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
    const results = uniqueCleanIds.map(id => {
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
  
  setExtractedOrders(results);
}, [emailText, data, singraData]);

  const performSync = async (forceDownload = false) => {
    if (!libLoaded) return;
    setLoading(true);
    setError("");

    try {
      const wmsHead = await fetch(`${WMS_URL}?t=${Date.now()}`, { method: 'HEAD' }).catch(() => null);
      const singraHead = await fetch(`${SINGRA_URL}?t=${Date.now()}`, { method: 'HEAD' }).catch(() => null);

      const wmsMod = wmsHead ? wmsHead.headers.get('last-modified') : null;
      const singraMod = singraHead ? singraHead.headers.get('last-modified') : null;

      if (!forceDownload) {
        const cachedData = await getFromCache('supplyData');
        if (cachedData && cachedData.wmsMod === wmsMod && cachedData.singraMod === singraMod) {
          setData(cachedData.wmsData);
          setSingraData(cachedData.singraData);
          setLastSync(cachedData.lastSync);
          setFileName("Carregado Rápido (Cache)");
          setLoading(false);
          return;
        }
      }

      const wmsRes = await fetch(`${WMS_URL}?t=${Date.now()}`);
      if (!wmsRes.ok) throw new Error("Falha ao baixar WMS");
      const wmsBuffer = await wmsRes.arrayBuffer();
      const wmsWb = window.XLSX.read(wmsBuffer, { type: 'array', cellDates: true });
      const wmsJson = window.XLSX.utils.sheet_to_json(wmsWb.Sheets[wmsWb.SheetNames[0]]);
      
      if (wmsJson.length === 0) throw new Error("A planilha da nuvem está vazia.");

      const normalizedWms = wmsJson.map(normalizeKeys);

      const normalizedSingra = await fetchSingraOnly();
      
      // Calcula a data mais recente de modificação entre as planilhas do Vercel
      let actualLastUpdate = new Date();
      if (wmsMod || singraMod) {
        const d1 = wmsMod ? new Date(wmsMod).getTime() : 0;
        const d2 = singraMod ? new Date(singraMod).getTime() : 0;
        actualLastUpdate = new Date(Math.max(d1, d2));
      }
      const lastSyncTime = actualLastUpdate.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      
      setData(normalizedWms);
      setSingraData(normalizedSingra);
      setLastSync(lastSyncTime);
      setFileName("Sincronizado na Nuvem ☁️");

      await saveToCache('supplyData', {
        wmsMod, 
        singraMod,
        wmsData: normalizedWms,
        singraData: normalizedSingra,
        lastSync: lastSyncTime
      });

    } catch (err) {
      console.error(err);
      setError("Falha na sincronização automatizada.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !libLoaded) return;

    setLoading(true);
    setError("");
    setAiAnalysis("");
    setFileName(file.name);
    // Usa a data real em que o arquivo foi modificado no computador
    setLastSync(new Date(file.lastModified).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));

    const singra = await fetchSingraOnly();
    setSingraData(singra);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = window.XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = window.XLSX.utils.sheet_to_json(ws);

        if (jsonData.length === 0) throw new Error("A planilha está vazia.");

        const normalizedData = jsonData.map(normalizeKeys);
        setData(normalizedData);
      } catch (err) {
        setError("Erro ao processar o arquivo.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadExcel = (dataSet, sheetName) => {
    if (!dataSet || dataSet.length === 0) return;
    const exportData = dataSet.map(item => ({
      CAM: item.cam || item.CAM || "-",
      PEDIDO: item.idOriginal || item.PEDIDO || item.RM || "S/N",
      CAPA: item.capa || item.CAPA || "-", // NOVA COLUNA CAPA
      STC: item.stc || item.STC || "-", 
      STATUS_WMS: item.wmsStatus || item.STATUS || "-",
      STATUS_SINGRA: item.singraStatus || "-", 
      DATA_ENTRADA: item.dataEntrada || item.entryDateIso || (item.DATA_ENTRADA ? safeGetISODate(item.DATA_ENTRADA) : "-"),
      DATA_EXPEDICAO: item.dataSeparacao || (item.DATA_SEPARACAO ? safeGetISODate(item.DATA_SEPARACAO) : "-"),
      LOTE: item.lote || item.LOTE || "-", // NOVA COLUNA LOTE
      ...(item.daysOpen !== undefined ? { DIAS_EM_ABERTO: item.daysOpen } : {})
    }));

    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Dados");
    window.XLSX.writeFile(wb, `${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

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

    const normalizeString = (str) => String(str || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const startFilter = new Date(interfaceStartDate);
    startFilter.setHours(0,0,0,0);
    const endFilter = new Date(interfaceEndDate);
    endFilter.setHours(23,59,59,999);

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
      for(let i=0; i<7 && (idx-i)>=0; i++) {
         const val = sortedDates[idx-i].leadTimes.length ? sortedDates[idx-i].leadTimes.reduce((a,b)=>a+b,0)/sortedDates[idx-i].leadTimes.length : 0;
         if (val > 0) { sumLead7 += val; countLead7++; }
      }
      const leadTimeMa7 = countLead7 > 0 ? sumLead7/countLead7 : null;

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

  // Sempre que chartData mudar (novos dados syncados), resetamos o filtro visível para mostrar tudo
  useEffect(() => {
    setVisibleRange(null);
  }, [chartData]);

  const visibleRangeData = useMemo(() => {
    if (!chartData.length) return [];
    if (!visibleRange) return chartData; // Retorna tudo se não houver filtro ativo
    return chartData.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [chartData, visibleRange]);

  const selectionSummary = useMemo(() => {
    if (chartData.length === 0) return null;
    const startIndex = visibleRange ? visibleRange.startIndex : 0;
    const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;
    const viewSlice = chartData.slice(startIndex, endIndex + 1);
    
    const entradas = viewSlice.reduce((acc, curr) => acc + (curr.entradas || 0), 0);
    const separacoes = viewSlice.reduce((acc, curr) => acc + (curr.separacoes || 0), 0);
    const validDaysSlice = viewSlice.filter(d => d.leadTimeDaily > 0);
    const avgLead = validDaysSlice.length ? (validDaysSlice.reduce((acc, c) => acc + c.leadTimeDaily, 0) / validDaysSlice.length).toFixed(1) : 0;
    return { entradas, separacoes, balanco: separacoes - entradas, numDias: viewSlice.length, mediaEntradasPeriodo: (entradas / viewSlice.length).toFixed(2), mediaSeparacoesPeriodo: (separacoes / viewSlice.length).toFixed(2), avgLeadTimePeriodo: avgLead };
  }, [chartData, visibleRange]);

  const slaAnalysis = useMemo(() => {
    if (data.length === 0 || chartData.length === 0) return { taxaNoPrazo: 0 };
    const startIndex = visibleRange ? visibleRange.startIndex : 0;
    const endIndex = visibleRange ? visibleRange.endIndex : chartData.length - 1;
    
    const startDate = new Date(chartData[startIndex]?.date);
    const endDate = new Date(chartData[endIndex]?.date);

    let expedidosTotal = 0;
    let expedidosNoPrazo = 0;
    const metaSlaDias = 20; 

    data.forEach(item => {
      const sepDateStr = safeGetISODate(item.DATA_SEPARACAO);
      const entryDateStr = safeGetISODate(item.DATA_ENTRADA);
      const status = String(item.STATUS || "").toUpperCase().trim();

      if (status === "EXPEDIDO" && sepDateStr && entryDateStr) {
        const sepDate = new Date(sepDateStr);
        if (sepDate >= startDate && sepDate <= endDate) {
          expedidosTotal++;
          const entryDate = new Date(entryDateStr);
          const diffDays = Math.ceil((sepDate - entryDate) / (1000 * 60 * 60 * 24));
          if (diffDays <= metaSlaDias) expedidosNoPrazo++;
        }
      }
    });

    const taxa = expedidosTotal > 0 ? ((expedidosNoPrazo / expedidosTotal) * 100).toFixed(1) : 0;
    return { taxaNoPrazo: taxa };
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

  // --- INÍCIO: PROCESSAMENTO DO GRÁFICO YoY ---
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

  // Auto-seleciona os dois anos mais recentes ao carregar os dados
  useEffect(() => {
    if (yoyAnalysis.availableYears.length > 0 && selectedYoyYears.length === 0) {
      setSelectedYoyYears(yoyAnalysis.availableYears.slice(0, 2)); 
    }
  }, [yoyAnalysis.availableYears, selectedYoyYears.length]);

  const toggleYoyYear = (year) => {
    setSelectedYoyYears(prev => 
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year].sort((a, b) => b - a)
    );
  };
  // --- FIM: PROCESSAMENTO DO GRÁFICO YoY ---

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

  const emailResultsSummary = useMemo(() => {
    const summary = {};
    extractedOrders.forEach(order => {
      const status = order.wmsStatus || "NÃO LOCALIZADO";
      summary[status] = (summary[status] || 0) + 1;
    });
    return Object.entries(summary);
  }, [extractedOrders]);
  
  const analyzeWithAI = async () => {
    if (!chartData || chartData.length === 0 || isAnalyzing || !selectionSummary) return;
    setIsAnalyzing(true);
    setAiError("");
    setAiAnalysis("");
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Chave da API Gemini não configurada (VITE_GEMINI_API_KEY).");

      const totalEntradasHist = chartData.reduce((acc, curr) => acc + (curr.entradas || 0), 0);
      const totalSaidasHist = chartData.reduce((acc, curr) => acc + (curr.separacoes || 0), 0);
      const mediaHistoricaSaidas = chartData.length > 0 ? (totalSaidasHist / chartData.length).toFixed(2) : 0;
      const picoHistorico = chartData.length > 0 ? Math.max(...chartData.map(d => d.separacoes || 0)) : 0;
      const mediaLeadHistorico = chartData.length > 0 ? (chartData.reduce((acc, curr) => acc + (curr.leadTimeDaily || 0), 0) / chartData.length).toFixed(2) : 0;
      const resumoErrosInterface = interfaceAnalysis?.falhasInterface.length || 0;

      const userQuery = `Analise em formato executivo: Histórico Entradas ${totalEntradasHist}, Saídas ${totalSaidasHist}, Média ${mediaHistoricaSaidas}, Lead Time ${mediaLeadHistorico}. Período selecionado: Entradas ${selectionSummary.entradas}, Saídas ${selectionSummary.separacoes}, SLA ${slaAnalysis.taxaNoPrazo}%. Backlog: ${backlogAnalysis?.totalPending} pedidos. Interface: ${resumoErrosInterface} divergências.`;

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
      const result = await model.generateContent({
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: "Você é um consultor sênior de Supply Chain. Gere um diagnóstico operacional fluido, sem asteriscos ou tabelas, focado em ajudar o tomador de decisão. Use os rótulos originais: Entradas (Corte), Saídas (Corte), Nível de Serviço (Até 20 dias)." }] }
      });
      const rawText = result.response.text();
      setAiAnalysis(rawText.replace(/[#*`>-]/g, "").trim());
    } catch (err) {
      setAiError(err.message || "Erro ao conectar com a Inteligência Artificial.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 overflow-x-hidden">
      <div className="w-full px-4 py-4 md:px-10 md:py-8 transition-all">
        <header className="mb-8 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 group">
              <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg transition-transform group-hover:scale-110"><Activity className="text-white" size={24} /></div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Monitor Logístico: <span className="text-indigo-600">Dashboard de acompanhamento de RM</span></h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">WMS & Singra</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-3">
                <button onClick={() => performSync(true)} disabled={loading} className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 text-white shadow-sm flex items-center gap-2 hover:bg-indigo-700 transition-all text-sm disabled:opacity-50 active:scale-95">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />} Sincronizar Robôs
                </button>
                <label className="px-6 py-2.5 rounded-xl font-bold bg-white border border-slate-200 shadow-sm flex items-center gap-2 hover:border-indigo-500 hover:text-indigo-600 transition-all text-sm cursor-pointer active:scale-95">
                  <Upload size={18} /> {fileName || "Upload Manual"}
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              {lastSync && (
                <div className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5 bg-slate-200/50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                  <Clock size={12} className="text-indigo-500" /> Última atualização: <span className="text-slate-700">{lastSync}</span>
                </div>
              )}
            </div>
          </div>
          {data.length > 0 && (
            <div className="flex p-1 bg-white rounded-2xl border border-slate-200 w-fit shadow-sm overflow-x-auto max-w-full">
              <button onClick={() => setActiveTab('dashboard')} className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard size={16} /> Indicadores</button>
              <button onClick={() => setActiveTab('backlog')} className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'backlog' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Hourglass size={16} /> RM em processamento</button>
              <button onClick={() => setActiveTab('interface')} className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'interface' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Network size={16} /> Interface SINGRA x WMS</button>
              <button onClick={() => setActiveTab('email')} className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'email' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Search size={16} /> Busca por E-mail</button>
            </div>
          )}
        </header>

        {data.length > 0 ? (
          activeTab === 'dashboard' ? (
            <DashboardTab
              selectionSummary={selectionSummary}
              backlogAnalysis={backlogAnalysis}
              slaAnalysis={slaAnalysis}
              chartData={chartData}
              visibleRangeData={visibleRangeData}
              dynamicAnalysis={dynamicAnalysis}
              aiAnalysis={aiAnalysis}
              isAnalyzing={isAnalyzing}
              analyzeWithAI={analyzeWithAI}
              visibleRange={visibleRange}
              setVisibleRange={setVisibleRange}
              selectedPiSegment={selectedPiSegment}
              setSelectedPiSegment={setSelectedPiSegment}
              data={data}
            />
          ) : activeTab === 'backlog' ? (
            <BacklogTab
              backlogAnalysis={backlogAnalysis}
              backlogStartDate={backlogStartDate}
              setBacklogStartDate={setBacklogStartDate}
              backlogEndDate={backlogEndDate}
              setBacklogEndDate={setBacklogEndDate}
              backlogTypeFilter={backlogTypeFilter}
              setBacklogTypeFilter={setBacklogTypeFilter}
              selectedBucket={selectedBucket}
              setSelectedBucket={setSelectedBucket}
              bucketSearchTerm={bucketSearchTerm}
              setBucketSearchTerm={setBucketSearchTerm}
              handleDownloadExcel={handleDownloadExcel}
              yoyAnalysis={yoyAnalysis}
              selectedYoyYears={selectedYoyYears}
              toggleYoyYear={toggleYoyYear}
              yoyMetrics={yoyMetrics}
              setYoyMetrics={setYoyMetrics}
            />
          ) : activeTab === 'interface' ? (
            <InterfaceTab
              interfaceAnalysis={interfaceAnalysis}
              activeInterfaceView={activeInterfaceView}
              setActiveInterfaceView={setActiveInterfaceView}
              selectedErrorFilter={selectedErrorFilter}
              setSelectedErrorFilter={setSelectedErrorFilter}
              interfaceStartDate={interfaceStartDate}
              setInterfaceStartDate={setInterfaceStartDate}
              interfaceEndDate={interfaceEndDate}
              setInterfaceEndDate={setInterfaceEndDate}
              handleDownloadExcel={handleDownloadExcel}
            />
          ) : activeTab === 'email' ? (
            <EmailSearchTab
              emailText={emailText}
              setEmailText={setEmailText}
              extractedOrders={extractedOrders}
              emailResultsSummary={emailResultsSummary}
              savedSearches={savedSearches}
              newSearchName={newSearchName}
              setNewSearchName={setNewSearchName}
              handleSaveSearch={handleSaveSearch}
              handleDeleteSearch={handleDeleteSearch}
              handleDownloadExcel={handleDownloadExcel}
            />
          ) : null
        ) : (
          <div className="mt-32 text-center flex flex-col items-center animate-pulse">
             <div className={`w-40 h-40 bg-white rounded-[50px] shadow-2xl flex items-center justify-center mb-8 border border-slate-100`}>
               {loading ? <Loader2 size={60} className="text-indigo-500 animate-spin" /> : <Database size={60} className="text-indigo-500 opacity-20" />}
             </div>
             <h2 className="text-2xl font-black text-slate-800 tracking-tight">Supply Monitor Integrado</h2>
             <p className="text-slate-400 text-sm mt-2 font-medium">Aguarde o carregamento ou clique em Sincronizar Robôs.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
