import { useCallback, useEffect, useMemo, useState } from 'react';
import { safeGetISODate } from '../utils/dates';
import * as armazem from '../utils/programacao/armazenamento';
import { TRATAMENTOS, configVazia, configCompleta } from '../utils/programacao/rotas';

// Junta duas listas que nunca batem sozinhas: os CAMs que de fato
// aparecem no WMS e o cadastro de rotas feito pelo programador.
//
// A lista de CAMs não é digitada: ela sai do próprio movimento. Assim um
// cliente novo aparece sozinho como pendente, e um que parou de ser
// usado pode ser ocultado sem sumir do histórico.
export const useCamConfig = (data, auth) => {
  const autenticado = Boolean(auth?.autenticado);
  const [configs, setConfigs] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(0);

  useEffect(() => {
    if (!autenticado) { setConfigs([]); return; }
    let vivo = true;
    setCarregando(true);
    armazem.carregarCamConfig()
      .then(c => { if (vivo) { setConfigs(c); setErro(''); } })
      .catch(e => { console.error(e); if (vivo) setErro('Não foi possível carregar o cadastro de CAM.'); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [autenticado]);

  // O que o WMS conhece de cada CAM: volume e último movimento. É o que
  // permite ordenar por relevância e enxergar CAM parado há anos.
  const camsDoWms = useMemo(() => {
    const mapa = new Map();
    (data || []).forEach(item => {
      const cam = String(item.CAM || '').trim();
      if (!cam) return;
      if (!mapa.has(cam)) mapa.set(cam, { cam, linhas: 0, rms: new Set(), ultimo: null });
      const r = mapa.get(cam);
      r.linhas++;
      r.rms.add(String(item.PEDIDO || '').trim());
      const d = safeGetISODate(item.DATA_SEPARACAO) || safeGetISODate(item.DATA_ENTRADA);
      if (d && (!r.ultimo || d > r.ultimo)) r.ultimo = d;
    });
    return Array.from(mapa.values()).map(r => ({ ...r, rms: r.rms.size }));
  }, [data]);

  const porCam = useMemo(() => new Map(configs.map(c => [c.cam, c])), [configs]);

  const linhas = useMemo(() => camsDoWms
    .map(w => {
      const c = porCam.get(w.cam) || configVazia(w.cam);
      return { ...w, config: c, completo: configCompleta(c) };
    })
    .sort((a, b) => b.rms - a.rms), [camsDoWms, porCam]);

  const resumo = useMemo(() => {
    const conta = (t) => linhas.filter(l => l.config.tratamento === t).length;
    return {
      total: linhas.length,
      gtc: conta(TRATAMENTOS.GTC),
      stc: conta(TRATAMENTOS.STC),
      ocultos: conta(TRATAMENTOS.OCULTO),
      pendentes: conta(TRATAMENTOS.PENDENTE),
      incompletos: linhas.filter(l => l.config.tratamento !== TRATAMENTOS.PENDENTE && !l.completo).length
    };
  }, [linhas]);

  const salvar = useCallback(async (nova) => {
    setConfigs(a => {
      const resto = a.filter(c => c.cam !== nova.cam);
      return [...resto, nova].sort((x, y) => x.cam.localeCompare(y.cam));
    });
    setSalvando(n => n + 1);
    try {
      await armazem.salvarCamConfig(nova, auth?.nome);
      setErro('');
    } catch (e) {
      console.error(e);
      setErro(`Não foi possível salvar o cadastro de ${nova.cam}. Recarregue a página para ver o que foi gravado.`);
    } finally {
      setSalvando(n => n - 1);
    }
  }, [auth?.nome]);

  return { linhas, resumo, salvar, carregando, salvando: salvando > 0, erro, porCam };
};
