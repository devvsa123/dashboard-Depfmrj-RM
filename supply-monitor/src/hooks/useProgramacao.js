import { useMemo, useState, useEffect, useCallback } from 'react';
import { medirCapacidade, indexarWms, filaPorAntiguidade, JANELAS } from '../utils/programacao/capacidade';
import { programarSemana, DIAS_EXPEDICAO_PADRAO, ORIGENS } from '../utils/programacao/motor';
import { extrairRms, conferirRms } from '../utils/programacao/rms';
import { hojeIso, segundaDaSemana, somaDias } from '../utils/programacao/semana';

const CHAVE = 'depfmrj.programacao.v1';

// Estado da programação. Hoje grava no navegador; quando o módulo ganhar
// login (Supabase), só esta camada muda — o motor e as telas continuam
// iguais, porque ninguém fala com o localStorage fora daqui.
const carregar = () => {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? JSON.parse(bruto) : null;
  } catch { return null; }
};

export const useProgramacao = (data) => {
  const inicial = useMemo(() => carregar() || {}, []);

  const [semanaRef, setSemanaRef] = useState(() => inicial.semanaRef || segundaDaSemana(somaDias(hojeIso(), 7)));
  const [demandas, setDemandas] = useState(() => inicial.demandas || []);
  const [bloqueios, setBloqueios] = useState(() => inicial.bloqueios || []);
  const [overrides, setOverrides] = useState(() => inicial.overrides || {});
  const [janelaDias, setJanelaDias] = useState(() => inicial.janelaDias || 365);
  const [programador, setProgramador] = useState(() => inicial.programador || '');
  const [encarregado, setEncarregado] = useState(() => inicial.encarregado || '');

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ semanaRef, demandas, bloqueios, overrides, janelaDias, programador, encarregado }));
    } catch { /* cota cheia ou modo privado: a programação segue na memória */ }
  }, [semanaRef, demandas, bloqueios, overrides, janelaDias, programador, encarregado]);

  const indiceWms = useMemo(() => indexarWms(data), [data]);
  const capacidadeMedida = useMemo(() => medirCapacidade(data, janelaDias), [data, janelaDias]);
  const fila = useMemo(() => filaPorAntiguidade(indiceWms, hojeIso()), [indiceWms]);

  // As RMs de cada demanda enriquecidas com a situação atual no WMS.
  const demandasConferidas = useMemo(() => demandas.map(d => {
    const conferencia = conferirRms(d.rms || [], indiceWms);
    return { ...d, conferencia, rmsEmFila: conferencia.EM_FILA };
  }), [demandas, indiceWms]);

  const resultado = useMemo(() => {
    if (!capacidadeMedida) return null;
    return programarSemana({
      semanaRef,
      demandas: demandasConferidas.map(d => ({
        ...d,
        origemLabel: ORIGENS.find(o => o.key === d.origem)?.label || d.origem,
        rms: d.rmsEmFila
      })),
      fila,
      capacidade: { porDiaSemana: capacidadeMedida.porDiaSemana, overrides },
      bloqueios,
      hoje: hojeIso()
    });
  }, [semanaRef, demandasConferidas, fila, capacidadeMedida, overrides, bloqueios]);

  const adicionarDemanda = useCallback(({ texto, origem, referencia, prazo, diasExpedicao }) => {
    const { rms, duplicadas, totalEncontrado } = extrairRms(texto);
    if (!rms.length) return { erro: 'Nenhuma RM encontrada no texto colado. O número da RM tem 8 dígitos (ex: 15757540 ou 15.757.540).' };
    setDemandas(atual => [...atual, {
      id: `D${Date.now()}`,
      origem: origem || 'OUTRO',
      referencia: referencia?.trim() || '',
      prazo: prazo || null,
      diasExpedicao: Number(diasExpedicao) || DIAS_EXPEDICAO_PADRAO,
      rms,
      criadaEm: hojeIso()
    }]);
    return { ok: true, encontradas: rms.length, duplicadas, totalEncontrado };
  }, []);

  const removerDemanda = useCallback((id) => setDemandas(a => a.filter(d => d.id !== id)), []);

  const adicionarBloqueio = useCallback((data_, motivo) => {
    if (!data_ || !motivo?.trim()) return;
    setBloqueios(a => [...a.filter(b => b.data !== data_), { data: data_, motivo: motivo.trim() }].sort((x, y) => x.data.localeCompare(y.data)));
  }, []);

  const removerBloqueio = useCallback((data_) => setBloqueios(a => a.filter(b => b.data !== data_)), []);

  const definirOverride = useCallback((dia, valor) => {
    setOverrides(a => {
      const novo = { ...a };
      if (valor === '' || valor === null || valor === undefined) delete novo[dia];
      else novo[dia] = Math.max(0, Number(valor));
      return novo;
    });
  }, []);

  return {
    semanaRef, setSemanaRef,
    demandas: demandasConferidas, adicionarDemanda, removerDemanda,
    bloqueios, adicionarBloqueio, removerBloqueio,
    overrides, definirOverride,
    janelaDias, setJanelaDias, janelas: JANELAS,
    programador, setProgramador, encarregado, setEncarregado,
    capacidadeMedida, fila, resultado
  };
};
