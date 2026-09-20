import { useCallback, useEffect, useState } from 'react';
import { XLSX_SCRIPT_URL, WMS_URL, SINGRA_URL } from '../constants';
import { saveToCache, getFromCache } from '../utils/cache';
import { normalizeKeys, fetchSingraOnly } from '../utils/spreadsheet';

// Carrega o WMS/SINGRA da nuvem (ou do cache local, quando as planilhas
// não mudaram) e mantém o motor de planilhas (SheetJS) carregado no window.
export const useSpreadsheetSync = () => {
  const [data, setData] = useState([]);
  const [singraData, setSingraData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [libLoaded, setLibLoaded] = useState(false);
  const [lastSync, setLastSync] = useState(null);

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

  const performSync = useCallback(async (forceDownload = false) => {
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
  }, [libLoaded]);

  useEffect(() => {
    // Roda uma única vez quando o motor de planilhas fica pronto, se ainda
    // não há dados carregados (cache ou nuvem). `performSync` já reavalia
    // `data` a cada chamada, então não o incluímos aqui para não repetir a
    // sincronização toda vez que `data` mudar.
    if (libLoaded && data.length === 0) {
      performSync(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libLoaded]);

  return { data, singraData, loading, error, lastSync, performSync };
};
