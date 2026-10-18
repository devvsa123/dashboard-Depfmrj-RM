import { ORIGENS } from './motor';

// Versionamento da programação. Cada publicação congela uma fotografia da
// semana; a seguinte é uma ALTERAÇÃO, e o documento precisa dizer o que
// mudou em relação à anterior — senão quem recebe a terceira versão da
// semana não tem como saber o que olhar.
//
// A fotografia guarda só o necessário para redesenhar o documento, e não o
// resultado inteiro do motor: a programação de uma semana tem centenas de
// RMs e várias versões convivem no mesmo navegador.

const ORIGEM_LABEL = Object.fromEntries(ORIGENS.map(o => [o.key, o.label]));
ORIGEM_LABEL.ANTIGUIDADE = 'Fila por antiguidade';

export const montarSnapshot = ({ resultado, bloqueios, demandas }) => ({
  grade: resultado.grade.map(s => ({
    dia: s.dia,
    capacidade: s.capacidade,
    bloqueio: s.bloqueio ? { motivo: s.bloqueio.motivo } : null,
    manual: s.manual,
    alocacoes: s.alocacoes.map(a => ({
      rm: a.rm,
      cam: a.cam || '',
      origem: a.origem,
      justificativa: a.justificativa,
      prazo: a.prazo || null,
      diasEmFila: a.diasEmFila ?? null
    }))
  })),
  porCam: resultado.porCam,
  resumo: resultado.resumo,
  alertas: resultado.alertas,
  bloqueios: bloqueios.map(b => ({ ...b })),
  demandas: demandas
    .filter(d => d.prazo && d.rmsEmFila?.length)
    .map(d => ({
      id: d.id,
      origem: d.origem,
      referencia: d.referencia,
      prazo: d.prazo,
      diasExpedicao: d.diasExpedicao,
      // O total que a origem informou, e não o que sobrou para programar:
      // a mensagem cobra o lote inteiro, mesmo que parte já tenha saído. O
      // quanto foi cumprido é assunto do acompanhamento, não da
      // programação da semana.
      qtd: (d.rms || []).length,
      qtdNaSemana: d.rmsEmFila.length
    }))
});

const indexarPorRm = (snapshot) => {
  const mapa = new Map();
  snapshot.grade.forEach(s => s.alocacoes.forEach(a => mapa.set(a.rm, { ...a, dia: s.dia })));
  return mapa;
};

// O que mudou de uma versão para a outra. É o conteúdo do Anexo B.
export const compararVersoes = (anterior, atual) => {
  if (!anterior) return null;
  const antes = indexarPorRm(anterior);
  const agora = indexarPorRm(atual);

  const entraram = [];
  const sairam = [];
  const remanejadas = [];

  agora.forEach((a, rm) => {
    const b = antes.get(rm);
    if (!b) { entraram.push(a); return; }
    if (b.dia !== a.dia) remanejadas.push({ ...a, diaAnterior: b.dia });
  });
  antes.forEach((b, rm) => {
    if (!agora.has(rm)) sairam.push(b);
  });

  const motivosAntes = new Set(anterior.bloqueios.map(x => `${x.data}|${x.motivo}`));
  const motivosAgora = new Set(atual.bloqueios.map(x => `${x.data}|${x.motivo}`));
  const bloqueiosNovos = atual.bloqueios.filter(x => !motivosAntes.has(`${x.data}|${x.motivo}`));
  const bloqueiosRemovidos = anterior.bloqueios.filter(x => !motivosAgora.has(`${x.data}|${x.motivo}`));

  const idsAntes = new Set(anterior.demandas.map(d => d.id));
  const demandasNovas = atual.demandas.filter(d => !idsAntes.has(d.id));

  return {
    entraram, sairam, remanejadas,
    bloqueiosNovos, bloqueiosRemovidos, demandasNovas,
    totalMudancas: entraram.length + sairam.length + remanejadas.length
      + bloqueiosNovos.length + bloqueiosRemovidos.length,
    deltaProgramado: atual.resumo.totalProgramado - anterior.resumo.totalProgramado
  };
};

// Agrupa uma lista de RMs do diff por CAM e motivo, para o anexo não virar
// uma coluna de centenas de números soltos.
export const agruparParaAnexo = (itens) => {
  const grupos = new Map();
  itens.forEach(a => {
    const cam = a.cam || '(sem CAM)';
    const chave = a.origem === 'ANTIGUIDADE' ? `ANTIGUIDADE||${cam}` : `${a.justificativa}||${cam}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, { cam, origem: a.origem, justificativa: a.justificativa, rms: [], dias: [] });
    }
    const g = grupos.get(chave);
    g.rms.push(a.rm);
    if (a.diasEmFila != null) g.dias.push(a.diasEmFila);
  });
  grupos.forEach(g => {
    if (g.origem !== 'ANTIGUIDADE' || !g.dias.length) return;
    const min = Math.min(...g.dias);
    const max = Math.max(...g.dias);
    g.justificativa = min === max
      ? `Fila por antiguidade — ${max} dias em espera`
      : `Fila por antiguidade — de ${min} a ${max} dias em espera`;
  });
  return Array.from(grupos.values()).sort((a, b) => b.rms.length - a.rms.length);
};

export const rotuloVersao = (numero) => (numero === 0 ? 'Original' : `Alteração nº ${numero}`);
