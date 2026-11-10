import { useCallback, useEffect, useRef, useState } from 'react';
import { WMS_PAR_URL, SINGRA_PAR_URL } from '../constants';
import { saveToCache, getFromCache } from '../utils/cache';
import { normalizeKeys, fetchSingraOnly } from '../utils/spreadsheet';

// Par WMS x SINGRA para a aba "Interface SINGRA x WMS".
//
// O WMS é atualizado a cada ~5 min e o SINGRA a cada ~30. Cruzar o SINGRA de
// 20 min atrás com o WMS de agora acusa "falha de interface" em tudo que um
// operador mexeu nesse intervalo: não é falha, é o SINGRA ainda não ter
// recebido. O robô do SINGRA publica, a cada ciclo, o CSV dele junto com o
// WMS do instante em que começou a extrair (pasta dados_interface/ do
// repositório de planilhas); este hook carrega esse par.
//
// Estados:
//   idle          ainda não começou (esperando a carga normal das planilhas)
//   loading       baixando/lendo o par
//   ok            par carregado; `par` traz os dados e a hora de cada metade
//   indisponivel  o robô ainda não publicou o par (ou ele falhou): quem usa
//                 cai de volta para o WMS/SINGRA "ao vivo" e avisa na tela
//
// O par muda só a cada ciclo do SINGRA, então fica em cache no IndexedDB
// (chave própria), validado pelo SHA do arquivo + Last-Modified de cada metade.

const CHAVE_CACHE = 'supplyPar';

// Hora de cada metade a partir do Last-Modified (que o servidor tira do atualizado.json).
export const formatarHoraPar = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;

export const useParInterface = (libLoaded, liveReady) => {
  const [par, setPar] = useState(null);
  const [status, setStatus] = useState('idle');
  const iniciou = useRef(false);

  const carregar = useCallback(async () => {
    setStatus('loading');
    try {
      const [wmsHead, singraHead] = await Promise.all([
        fetch(`${WMS_PAR_URL}?t=${Date.now()}`, { method: 'HEAD' }).catch(() => null),
        fetch(`${SINGRA_PAR_URL}?t=${Date.now()}`, { method: 'HEAD' }).catch(() => null)
      ]);
      if (!wmsHead?.ok || !singraHead?.ok) {
        setPar(null);
        setStatus('indisponivel');
        return;
      }

      const wmsMod = wmsHead.headers.get('last-modified');
      const singraMod = singraHead.headers.get('last-modified');
      const versao = [wmsHead.headers.get('x-blob-sha'), singraHead.headers.get('x-blob-sha'), wmsMod, singraMod].join('|');

      const emCache = await getFromCache(CHAVE_CACHE);
      if (emCache && emCache.versao === versao) {
        setPar(emCache);
        setStatus('ok');
        return;
      }

      const wmsRes = await fetch(`${WMS_PAR_URL}?t=${Date.now()}`);
      if (!wmsRes.ok) throw new Error('Falha ao baixar o WMS do par');
      const wb = window.XLSX.read(await wmsRes.arrayBuffer(), { type: 'array', cellDates: true });
      const wmsData = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]).map(normalizeKeys);
      const singraData = await fetchSingraOnly(SINGRA_PAR_URL);
      // Um lado vazio é arquivo ruim, não "nenhuma RM": melhor cair no ao vivo que comparar com nada.
      if (wmsData.length === 0 || singraData.length === 0) throw new Error('O par veio com uma planilha vazia');

      const novo = { versao, wmsMod, singraMod, wmsData, singraData };
      setPar(novo);
      setStatus('ok');
      await saveToCache(CHAVE_CACHE, novo);
    } catch (err) {
      console.error('Par WMS x SINGRA indisponível:', err);
      setPar(null);
      setStatus('indisponivel');
    }
  }, []);

  useEffect(() => {
    // Só depois da carga normal: o par não pode atrasar as outras abas. Roda uma vez por abertura do site,
    // como a carga normal.
    if (libLoaded && liveReady && !iniciou.current) {
      iniciou.current = true;
      carregar();
    }
  }, [libLoaded, liveReady, carregar]);

  return { par, status };
};
