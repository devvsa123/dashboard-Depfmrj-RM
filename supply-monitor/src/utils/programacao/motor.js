import { diasUteisDaSemana, diaDaSemana, somaDiasUteis, formatarBr, diffDias } from './semana';

// Motor de programação semanal.
//
// Duas filas disputam a mesma capacidade:
//   1. Demandas COM PRAZO (mensagem, gerência). Agendadas de trás para
//      frente a partir do prazo, descontando os dias de expedição — o
//      prazo é de EMI da STC, não de separação, então a separação precisa
//      terminar antes para a expedição ter tempo de prontificar.
//   2. O resto da fila, da RM mais antiga para a mais nova, preenchendo o
//      que sobrar de cada dia.
//
// O motor nunca decide sozinho o que sacrificar: quando a demanda com
// prazo não cabe, ele aloca o que couber e devolve o conflito para o
// programador resolver. Validador é quem decide.

export const ORIGENS = [
  { key: 'MENSAGEM', label: 'Mensagem', descricao: 'Mensagem oficial com prazo' },
  { key: 'GERENCIA', label: 'Gerência de Fardamento', descricao: 'Solicitação da gerência' },
  { key: 'OUTRO', label: 'Outra demanda', descricao: 'Demanda informal registrada pelo programador' }
];

export const DIAS_EXPEDICAO_PADRAO = 3;

// Último dia em que a separação pode terminar para o prazo ser cumprido.
export const limiteDeSeparacao = (prazo, diasExpedicao) =>
  (prazo ? somaDiasUteis(prazo, -(diasExpedicao ?? DIAS_EXPEDICAO_PADRAO)) : null);

const capacidadeDoDia = (dia, capacidade, bloqueios) => {
  const bloqueio = bloqueios.find(b => b.data === dia);
  if (bloqueio) return { total: 0, bloqueio };
  const manual = capacidade.overrides?.[dia];
  if (manual !== undefined && manual !== null && manual !== '') {
    return { total: Math.max(0, Number(manual)), manual: true };
  }
  return { total: capacidade.porDiaSemana?.[diaDaSemana(dia)] ?? 0 };
};

export const programarSemana = ({
  semanaRef,
  demandas = [],
  fila = [],
  capacidade = { porDiaSemana: {}, overrides: {} },
  bloqueios = [],
  hoje
}) => {
  const dias = diasUteisDaSemana(semanaRef);
  const grade = dias.map(dia => {
    const cap = capacidadeDoDia(dia, capacidade, bloqueios);
    return { dia, capacidade: cap.total, bloqueio: cap.bloqueio || null, manual: Boolean(cap.manual), restante: cap.total, alocacoes: [] };
  });
  const porDia = new Map(grade.map(g => [g.dia, g]));

  const alertas = [];
  const jaAlocadas = new Set();
  const naoAlocadas = [];

  const alocar = (dia, registro) => {
    const slot = porDia.get(dia);
    if (!slot || slot.restante <= 0) return false;
    slot.alocacoes.push(registro);
    slot.restante--;
    jaAlocadas.add(registro.rm);
    return true;
  };

  // ── Fila 1: demandas com prazo, da mais apertada para a mais folgada ──
  const comPrazo = demandas
    .filter(d => d.prazo)
    .sort((a, b) => a.prazo.localeCompare(b.prazo));
  const semPrazo = demandas.filter(d => !d.prazo);

  const processaDemanda = (demanda, limite) => {
    const diasDisponiveis = grade
      .filter(g => !g.bloqueio && g.capacidade > 0 && (!limite || g.dia <= limite))
      .map(g => g.dia);

    const pendentes = [];
    (demanda.rms || []).forEach(item => {
      const rm = typeof item === 'string' ? item : item.rm;
      if (jaAlocadas.has(rm)) return;
      pendentes.push(typeof item === 'string' ? { rm } : item);
    });

    const justificativa = demanda.prazo
      ? `${demanda.referencia || demanda.origemLabel} — prazo ${formatarBr(demanda.prazo)}`
      : (demanda.referencia || demanda.origemLabel);

    let restantes = [...pendentes];
    // Preenche do dia mais cedo para o mais tarde: sobra folga no fim.
    diasDisponiveis.forEach(dia => {
      while (restantes.length && porDia.get(dia).restante > 0) {
        const item = restantes.shift();
        alocar(dia, { ...item, origem: demanda.origem, demandaId: demanda.id, justificativa, prazo: demanda.prazo || null });
      }
    });

    if (restantes.length) {
      restantes.forEach(item => naoAlocadas.push({ ...item, demandaId: demanda.id, justificativa, motivo: limite ? 'SEM_CAPACIDADE_ATE_O_PRAZO' : 'SEM_CAPACIDADE' }));
      alertas.push({
        nivel: limite ? 'critico' : 'atencao',
        demandaId: demanda.id,
        texto: limite
          ? `${restantes.length} RM(s) de "${demanda.referencia || demanda.origemLabel}" não cabem na capacidade até ${formatarBr(limite)} (prazo ${formatarBr(demanda.prazo)}).`
          : `${restantes.length} RM(s) de "${demanda.referencia || demanda.origemLabel}" não couberam na semana.`
      });
    }
  };

  comPrazo.forEach(demanda => {
    const limite = limiteDeSeparacao(demanda.prazo, demanda.diasExpedicao);
    // Prazo que já venceu ou que exige separação antes da semana: avisa e
    // programa o quanto antes, sem fingir que cabe.
    if (limite && limite < dias[0]) {
      alertas.push({
        nivel: 'critico',
        demandaId: demanda.id,
        texto: `"${demanda.referencia || demanda.origemLabel}" exigiria separação concluída até ${formatarBr(limite)}, antes desta semana. Programado no início da semana, com atraso.`
      });
      processaDemanda(demanda, null);
      return;
    }
    processaDemanda(demanda, limite);
  });

  semPrazo.forEach(demanda => processaDemanda(demanda, null));

  // ── Fila 2: as mais antigas preenchem o que sobrou ──
  const antigas = fila.filter(f => !jaAlocadas.has(f.rm));
  let idx = 0;
  grade.forEach(slot => {
    while (slot.restante > 0 && idx < antigas.length) {
      const item = antigas[idx++];
      alocar(slot.dia, {
        ...item,
        origem: 'ANTIGUIDADE',
        justificativa: item.diasEmFila != null
          ? `RM mais antiga em fila — ${item.diasEmFila} dias`
          : 'RM em fila'
      });
    }
  });

  const totalProgramado = grade.reduce((acc, g) => acc + g.alocacoes.length, 0);
  const capacidadeTotal = grade.reduce((acc, g) => acc + g.capacidade, 0);

  // Resumo por CAM — é o foco do documento final.
  const porCam = new Map();
  grade.forEach(slot => {
    slot.alocacoes.forEach(a => {
      const cam = a.cam || '(sem CAM)';
      if (!porCam.has(cam)) porCam.set(cam, { cam, total: 0, porDia: {} });
      const linha = porCam.get(cam);
      linha.total++;
      linha.porDia[slot.dia] = (linha.porDia[slot.dia] || 0) + 1;
    });
  });

  return {
    dias,
    grade,
    porCam: Array.from(porCam.values()).sort((a, b) => b.total - a.total),
    naoAlocadas,
    alertas,
    resumo: {
      totalProgramado,
      capacidadeTotal,
      ocupacao: capacidadeTotal ? Math.round((totalProgramado / capacidadeTotal) * 100) : 0,
      comPrazo: grade.reduce((acc, g) => acc + g.alocacoes.filter(a => a.prazo).length, 0),
      porAntiguidade: grade.reduce((acc, g) => acc + g.alocacoes.filter(a => a.origem === 'ANTIGUIDADE').length, 0),
      camsAtendidos: porCam.size,
      filaTotal: fila.length,
      diasBloqueados: grade.filter(g => g.bloqueio).length,
      folgaAteOPrazo: comPrazo.length && hoje
        ? Math.min(...comPrazo.map(d => diffDias(hoje, limiteDeSeparacao(d.prazo, d.diasExpedicao) || d.prazo)))
        : null
    }
  };
};
