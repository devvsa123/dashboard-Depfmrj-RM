import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { medirCapacidade, indexarWms, filaPorAntiguidade, JANELAS } from '../utils/programacao/capacidade';
import { programarSemana, DIAS_EXPEDICAO_PADRAO, ORIGENS } from '../utils/programacao/motor';
import { extrairRms, conferirRms } from '../utils/programacao/rms';
import { montarSnapshot, compararVersoes } from '../utils/programacao/versoes';
import { hojeIso, segundaDaSemana, somaDias, diasUteisDaSemana } from '../utils/programacao/semana';
import * as armazem from '../utils/programacao/armazenamento';

// Estado da programação, compartilhado entre os três programadores pelo
// banco. A gravação é otimista: a tela muda na hora e a escrita segue em
// paralelo; se falhar, o erro aparece — nunca fica a impressão de ter
// salvo o que não salvou.
export const useProgramacao = (data, auth, rotasPorCam = null) => {
  const autenticado = Boolean(auth?.autenticado);

  const [semanaRef, setSemanaRef] = useState(() => segundaDaSemana(somaDias(hojeIso(), 7)));
  const [demandas, setDemandas] = useState([]);
  const [bloqueios, setBloqueios] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [janelaDias, setJanelaDias] = useState(365);
  const [encarregado, setEncarregado] = useState('');
  const [versoes, setVersoes] = useState([]);
  // O config inteiro fica em estado porque algumas chaves são por semana
  // — os CAMs forçados, por exemplo, são uma decisão daquela semana e
  // não uma preferência do sistema.
  const [config, setConfig] = useState({});

  const [carregando, setCarregando] = useState(false);
  const [erroSync, setErroSync] = useState('');
  const [salvando, setSalvando] = useState(0);

  // Envolve toda escrita: conta quantas estão em voo (para o indicador de
  // "salvando") e transforma qualquer falha numa mensagem na tela.
  const comGravacao = useCallback(async (acao, oQue) => {
    setSalvando(n => n + 1);
    try {
      await acao();
      setErroSync('');
    } catch (e) {
      console.error(e);
      setErroSync(`Não foi possível salvar ${oQue}. A tela está à frente do banco — recarregue a página para ver o que foi gravado de fato.`);
    } finally {
      setSalvando(n => n - 1);
    }
  }, []);

  // ── Carga inicial, assim que o usuário entra ──────────────────────
  const jaCarregou = useRef(false);
  useEffect(() => {
    if (!autenticado) {
      jaCarregou.current = false;
      setDemandas([]); setBloqueios([]); setOverrides({}); setVersoes([]); setConfig({});
      return;
    }
    if (jaCarregou.current) return;
    jaCarregou.current = true;
    let vivo = true;
    setCarregando(true);
    armazem.carregarTudo()
      .then(({ demandas: d, bloqueios: b, overrides: o, config: c }) => {
        if (!vivo) return;
        setDemandas(d);
        setBloqueios(b);
        setOverrides(o);
        setConfig(c || {});
        if (c.janelaDias) setJanelaDias(Number(c.janelaDias));
        if (c.encarregado) setEncarregado(String(c.encarregado));
        setErroSync('');
      })
      .catch(e => {
        console.error(e);
        if (vivo) setErroSync('Não foi possível carregar a programação do banco. Verifique a conexão e recarregue a página.');
      })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [autenticado]);

  // ── Versões da semana selecionada ─────────────────────────────────
  useEffect(() => {
    if (!autenticado) return;
    let vivo = true;
    armazem.carregarVersoes(semanaRef)
      .then(v => { if (vivo) setVersoes(v); })
      .catch(e => {
        console.error(e);
        if (vivo) setErroSync('Não foi possível carregar as versões desta semana.');
      });
    return () => { vivo = false; };
  }, [autenticado, semanaRef]);

  // ── Leitura do WMS (não depende do banco) ─────────────────────────
  const indiceWms = useMemo(() => indexarWms(data), [data]);
  const capacidadeMedida = useMemo(() => medirCapacidade(data, janelaDias), [data, janelaDias]);
  const fila = useMemo(() => filaPorAntiguidade(indiceWms, hojeIso()), [indiceWms]);

  // ── O que pertence à semana que está na tela ──────────────────────
  //
  // Demanda, dia bloqueado e CAM forçado são decisões DAQUELA semana. Sem
  // este recorte, uma mensagem colada numa semana reaparecia em todas as
  // seguintes e o programador abria a semana nova já suja — pior ainda,
  // as RMs voltavam a ser programadas e o documento saía com dias sem
  // separação que não eram daquela semana.
  const diasDaSemana = useMemo(() => diasUteisDaSemana(semanaRef), [semanaRef]);

  const demandasDaSemana = useMemo(
    () => demandas.filter(d => d.semana === semanaRef),
    [demandas, semanaRef]
  );

  const bloqueiosDaSemana = useMemo(
    () => bloqueios.filter(b => b.data >= diasDaSemana[0] && b.data <= diasDaSemana[diasDaSemana.length - 1]),
    [bloqueios, diasDaSemana]
  );

  const chaveForcados = `forcados:${semanaRef}`;
  const forcados = useMemo(() => {
    const v = config[chaveForcados];
    return Array.isArray(v) ? v : [];
  }, [config, chaveForcados]);

  const demandasConferidas = useMemo(() => demandasDaSemana.map(d => {
    const conferencia = conferirRms(d.rms || [], indiceWms);
    return { ...d, conferencia, rmsEmFila: conferencia.EM_FILA };
  }), [demandasDaSemana, indiceWms]);

  // Os argumentos do motor ficam num lugar só para a simulação de
  // "e se eu forçar este CAM?" rodar exatamente a mesma programação,
  // mudando apenas a lista de forçados. Comparar duas execuções do mesmo
  // motor é o que permite dizer, sem chutar, quem sai da grade.
  const argumentosDoMotor = useCallback((forcadosAlvo) => ({
    semanaRef,
    demandas: demandasConferidas.map(d => ({
      ...d,
      origemLabel: ORIGENS.find(o => o.key === d.origem)?.label || d.origem,
      rms: d.rmsEmFila
    })),
    fila,
    capacidade: { porDiaSemana: capacidadeMedida?.porDiaSemana || {}, overrides },
    bloqueios: bloqueiosDaSemana,
    // O cadastro de rotas entra aqui: sem ele o motor volta a programar
    // só por antiguidade, que é o comportamento de antes.
    rotas: rotasPorCam,
    forcados: forcadosAlvo,
    hoje: hojeIso()
  }), [semanaRef, demandasConferidas, fila, capacidadeMedida, overrides, bloqueiosDaSemana, rotasPorCam]);

  const resultado = useMemo(() => {
    if (!capacidadeMedida) return null;
    return programarSemana(argumentosDoMotor(forcados));
  }, [argumentosDoMotor, capacidadeMedida, forcados]);

  // O impacto de forçar um CAM, medido rodando a semana de novo com ele
  // na frente e comparando com a grade atual.
  const simularForcar = useCallback((cam) => {
    if (!cam || !capacidadeMedida || !resultado) return null;
    const alternativo = programarSemana(argumentosDoMotor([...forcados, cam]));
    const antes = new Set(resultado.grade.flatMap(s => s.alocacoes.map(a => a.rm)));
    const depois = new Set(alternativo.grade.flatMap(s => s.alocacoes.map(a => a.rm)));

    const saindo = new Map();
    resultado.grade.forEach(s => s.alocacoes.forEach(a => {
      if (depois.has(a.rm)) return;
      const c = a.cam || '(sem CAM)';
      saindo.set(c, (saindo.get(c) || 0) + 1);
    }));
    const entrando = alternativo.grade.flatMap(s => s.alocacoes).filter(a => a.cam === cam && !antes.has(a.rm));

    return {
      cam,
      entram: entrando.length,
      jaEstavam: alternativo.grade.flatMap(s => s.alocacoes).filter(a => a.cam === cam).length - entrando.length,
      saem: Array.from(saindo.values()).reduce((t, n) => t + n, 0),
      camsAfetados: Array.from(saindo.entries()).map(([c, qtd]) => ({ cam: c, qtd })).sort((a, b) => b.qtd - a.qtd),
      naFila: fila.filter(f => f.cam === cam).length,
      totalProgramado: alternativo.resumo.totalProgramado,
      capacidadeTotal: alternativo.resumo.capacidadeTotal
    };
  }, [argumentosDoMotor, capacidadeMedida, resultado, forcados, fila]);

  // ── Mutações ──────────────────────────────────────────────────────
  const adicionarDemanda = useCallback(({ texto, origem, referencia, prazo, diasExpedicao }) => {
    const { rms, duplicadas, totalEncontrado } = extrairRms(texto);
    if (!rms.length) return { erro: 'Nenhuma RM encontrada no texto colado. O número da RM tem 8 dígitos (ex: 15757540 ou 15.757.540).' };
    const nova = {
      id: `D${Date.now()}`,
      origem: origem || 'OUTRO',
      referencia: referencia?.trim() || '',
      prazo: prazo || null,
      diasExpedicao: Number(diasExpedicao) || DIAS_EXPEDICAO_PADRAO,
      rms,
      semana: semanaRef,
      criadaEm: new Date().toISOString(),
      criadaPorNome: auth?.nome || ''
    };
    setDemandas(a => [...a, nova]);
    comGravacao(() => armazem.salvarDemanda(nova), 'a demanda');
    return { ok: true, encontradas: rms.length, duplicadas, totalEncontrado };
  }, [auth?.nome, comGravacao, semanaRef]);

  const removerDemanda = useCallback((id) => {
    setDemandas(a => a.filter(d => d.id !== id));
    comGravacao(() => armazem.apagarDemanda(id), 'a remoção da demanda');
  }, [comGravacao]);

  const adicionarBloqueio = useCallback((data_, motivo) => {
    if (!data_ || !motivo?.trim()) return;
    const novo = { data: data_, motivo: motivo.trim() };
    setBloqueios(a => [...a.filter(b => b.data !== data_), novo].sort((x, y) => x.data.localeCompare(y.data)));
    comGravacao(() => armazem.salvarBloqueio(novo), 'o dia bloqueado');
  }, [comGravacao]);

  const removerBloqueio = useCallback((data_) => {
    setBloqueios(a => a.filter(b => b.data !== data_));
    comGravacao(() => armazem.apagarBloqueio(data_), 'a liberação do dia');
  }, [comGravacao]);

  const definirOverride = useCallback((dia, valor) => {
    setOverrides(a => {
      const novo = { ...a };
      if (valor === '' || valor === null || valor === undefined) delete novo[dia];
      else novo[dia] = Math.max(0, Number(valor));
      return novo;
    });
    comGravacao(() => armazem.salvarOverride(dia, valor), 'a capacidade do dia');
  }, [comGravacao]);

  const mudarJanela = useCallback((dias) => {
    setJanelaDias(dias);
    comGravacao(() => armazem.salvarConfig('janelaDias', dias), 'a janela de medição');
  }, [comGravacao]);

  const mudarEncarregado = useCallback((nome) => {
    setEncarregado(nome);
    setConfig(c => ({ ...c, encarregado: nome }));
    comGravacao(() => armazem.salvarConfig('encarregado', nome), 'o nome do Encarregado');
  }, [comGravacao]);

  // ── Versões ───────────────────────────────────────────────────────
  const ultimaVersao = versoes.length ? versoes[versoes.length - 1] : null;

  const snapshotAtual = useMemo(
    // Bloqueios da SEMANA, não todos: antes o documento saía com dias
    // sem separação que pertenciam a outras semanas.
    () => (resultado ? montarSnapshot({ resultado, bloqueios: bloqueiosDaSemana, demandas: demandasConferidas }) : null),
    [resultado, bloqueiosDaSemana, demandasConferidas]
  );

  const diffPendente = useMemo(
    () => (ultimaVersao && snapshotAtual ? compararVersoes(ultimaVersao.snapshot, snapshotAtual) : null),
    [ultimaVersao, snapshotAtual]
  );

  const publicar = useCallback(async () => {
    if (!snapshotAtual) return null;
    const numero = versoes.length;
    const nova = {
      numero,
      publicadaEm: new Date().toISOString(),
      por: auth?.nome || '',
      snapshot: snapshotAtual
    };
    setVersoes(a => [...a, nova]);
    await comGravacao(
      () => armazem.salvarVersao({ semana: semanaRef, numero, por: nova.por, usuarioId: auth?.usuario?.id, snapshot: snapshotAtual }),
      'a publicação'
    );
    return nova;
  }, [snapshotAtual, versoes.length, semanaRef, auth?.nome, auth?.usuario?.id, comGravacao]);

  const removerUltimaVersao = useCallback(() => {
    if (!versoes.length) return;
    const numero = versoes[versoes.length - 1].numero;
    setVersoes(a => a.slice(0, -1));
    comGravacao(() => armazem.apagarVersao(semanaRef, numero), 'a remoção da versão');
  }, [versoes, semanaRef, comGravacao]);

  // Apaga tudo o que foi publicado nesta semana. Existe porque publicar
  // a semana errada acontece, e desfazer uma versão por vez não resolve
  // quando já são três.
  const apagarProgramacao = useCallback(() => {
    if (!versoes.length) return;
    setVersoes([]);
    comGravacao(() => armazem.apagarSemana(semanaRef), 'a remoção da programação da semana');
  }, [versoes, semanaRef, comGravacao]);

  const guardarForcados = useCallback((nova) => {
    setConfig(c => ({ ...c, [chaveForcados]: nova }));
    comGravacao(() => armazem.salvarConfig(chaveForcados, nova), 'a lista de CAMs forçados');
  }, [chaveForcados, comGravacao]);

  const forcarCam = useCallback((cam) => {
    if (!cam || forcados.includes(cam)) return;
    guardarForcados([...forcados, cam]);
  }, [forcados, guardarForcados]);

  const desforcarCam = useCallback((cam) => {
    guardarForcados(forcados.filter(c => c !== cam));
  }, [forcados, guardarForcados]);

  return {
    versoes, ultimaVersao, diffPendente, publicar, removerUltimaVersao, apagarProgramacao,
    forcados, forcarCam, desforcarCam, simularForcar,
    semanaRef, setSemanaRef,
    demandas: demandasConferidas, adicionarDemanda, removerDemanda,
    bloqueios: bloqueiosDaSemana, adicionarBloqueio, removerBloqueio,
    diasDaSemana,
    overrides, definirOverride,
    janelaDias, setJanelaDias: mudarJanela, janelas: JANELAS,
    programador: auth?.nome || '', encarregado, setEncarregado: mudarEncarregado,
    capacidadeMedida, fila, resultado, indiceWms,
    carregando, salvando: salvando > 0, erroSync
  };
};
