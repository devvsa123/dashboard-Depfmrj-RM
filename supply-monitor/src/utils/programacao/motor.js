import { diasUteisDaSemana, diaDaSemana, somaDiasUteis, formatarBr, diffDias } from './semana';
import { prazoDaRota } from './rotas';
import { urgenciaDe, porUrgencia } from './prioridade';

// Motor de programação semanal.
//
// Três filas disputam a mesma capacidade:
//   0. CAM FORÇADO pelo programador. Fura tudo, de propósito: demanda
//      emergencial sai da lógica normal de fornecimento. O custo aparece
//      na tela antes de forçar, e nos alertas depois.
//   1. Demandas COM PRAZO (mensagem, gerência). Agendadas de trás para
//      frente a partir do prazo, descontando os dias de expedição — o
//      prazo é de EMI da STC, não de separação, então a separação precisa
//      terminar antes para a expedição ter tempo de prontificar.
//   2. O resto da fila, da RM mais antiga para a mais nova, preenchendo o
//      que sobrar de cada dia — mas no dia certo para pegar a rota do
//      CAM, quando ela sai dentro da semana.
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
  rotas = null,
  forcados = [],
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

  // ── Fila 0: CAM forçado pelo programador ──
  //
  // Vem antes até das demandas com prazo. É uma decisão consciente: o
  // programador só força quando a demanda é emergencial, e o que ele
  // perde ao fazer isso já apareceu na tela antes de confirmar. O motor
  // não discute a ordem, mas registra o que ela custou.
  const forcadosSet = new Set((forcados || []).filter(Boolean));
  if (forcadosSet.size) {
    const alvo = fila.filter(f => forcadosSet.has(f.cam) && !jaAlocadas.has(f.rm));
    const naoCoube = new Map();
    alvo.forEach(item => {
      const slot = grade.find(g => !g.bloqueio && g.restante > 0);
      if (!slot) {
        naoCoube.set(item.cam, (naoCoube.get(item.cam) || 0) + 1);
        naoAlocadas.push({ ...item, justificativa: 'Atendimento forçado pelo programador', motivo: 'SEM_CAPACIDADE' });
        return;
      }
      alocar(slot.dia, { ...item, origem: 'FORCADO', justificativa: 'Atendimento forçado pelo programador' });
    });
    const forcadas = alvo.length - Array.from(naoCoube.values()).reduce((t, n) => t + n, 0);
    if (forcadas > 0) {
      alertas.push({
        nivel: 'atencao',
        texto: `${forcadas} RM(s) de ${Array.from(forcadosSet).join(', ')} foram programadas por ordem do programador, na frente da fila normal.`
      });
    }
    naoCoube.forEach((qtd, cam) => alertas.push({
      nivel: 'critico',
      texto: `${qtd} RM(s) de ${cam} foram forçadas mas não cabem na capacidade da semana.`
    }));
  }

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

  // ── Fila 2: o resto da fila, por urgência ──
  //
  // Antiguidade continua mandando em QUEM entra na semana. O cadastro de
  // rotas muda o DIA: separar na quinta o que sai na terça custa uma
  // semana inteira de espera na Expedição, porque o caminhão daquele CAM
  // já passou. Quem tem rota ou janela vencendo dentro da semana é
  // alocado antes do seu limite; o resto entra por antiguidade.
  const antigas = fila.filter(f => !jaAlocadas.has(f.rm));
  const ultimoDia = dias[dias.length - 1];
  const comUrgencia = antigas.map(item => {
    const rota = rotas ? prazoDaRota(rotas.get(item.cam), dias[0]) : null;
    const naSemana = rota && rota.conferirAte >= dias[0] && rota.conferirAte <= ultimoDia;
    return { ...item, urgencia: urgenciaDe({ rota: naSemana ? rota : null, entrada: item.entrada, diasEmFila: item.diasEmFila }) };
  });
  // A fila já vem por antiguidade e o sort é estável, então dentro de um
  // mesmo limite a mais antiga continua na frente.
  comUrgencia.sort((a, b) => porUrgencia(a.urgencia, b.urgencia));

  const perderamARota = [];
  const semLimite = [];
  comUrgencia.forEach(item => {
    const limite = item.urgencia.limite;
    if (!limite) { semLimite.push(item); return; }
    const slot = grade.find(g => !g.bloqueio && g.restante > 0 && g.dia <= limite);
    if (!slot) { perderamARota.push(item); return; }
    alocar(slot.dia, { ...item, origem: item.urgencia.motivo.key, justificativa: item.urgencia.texto });
  });

  // Quem não coube antes do próprio limite não some da semana: volta para
  // a fila comum. Mas o programador precisa saber, porque é material que
  // vai ficar pronto e esperar a saída seguinte.
  //
  // Um alerta por CAM encheria a tela: numa semana apertada quase todo
  // CAM perde alguma coisa, e trinta avisos iguais não informam mais que
  // um. Quando a capacidade da semana é zero o aviso nem aparece — o
  // problema ali é a capacidade, que já está à vista.
  if (perderamARota.length && grade.some(g => g.capacidade > 0)) {
    const porCamPerdido = new Map();
    perderamARota.forEach(item => {
      const cam = item.cam || '(sem CAM)';
      if (!porCamPerdido.has(cam)) porCamPerdido.set(cam, { cam, qtd: 0, urgencia: item.urgencia });
      porCamPerdido.get(cam).qtd++;
    });
    const lista = Array.from(porCamPerdido.values()).sort((a, b) => b.qtd - a.qtd);
    const primeiros = lista.slice(0, 3).map(g => `${g.cam} (${g.qtd})`).join(', ');
    alertas.push({
      nivel: 'atencao',
      texto: `${perderamARota.length} RM(s) de ${lista.length} CAM(s) não cabem antes do próprio limite de rota ou janela e vão ficar prontas esperando a saída seguinte: ${primeiros}${lista.length > 3 ? ` e mais ${lista.length - 3}` : ''}.`
    });
  }

  const sobraram = [...semLimite, ...perderamARota];
  let idx = 0;
  grade.forEach(slot => {
    while (slot.restante > 0 && idx < sobraram.length) {
      const item = sobraram[idx++];
      alocar(slot.dia, {
        ...item,
        origem: 'FILA',
        justificativa: item.diasEmFila != null
          ? `Fila por antiguidade — ${item.diasEmFila} dias de espera`
          : 'Fila por antiguidade'
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
      porAntiguidade: grade.reduce((acc, g) => acc + g.alocacoes.filter(a => a.origem === 'FILA').length, 0),
      porRota: grade.reduce((acc, g) => acc + g.alocacoes.filter(a => a.origem === 'ROTA' || a.origem === 'JANELA').length, 0),
      forcadas: grade.reduce((acc, g) => acc + g.alocacoes.filter(a => a.origem === 'FORCADO').length, 0),
      camsAtendidos: porCam.size,
      filaTotal: fila.length,
      diasBloqueados: grade.filter(g => g.bloqueio).length,
      folgaAteOPrazo: comPrazo.length && hoje
        ? Math.min(...comPrazo.map(d => diffDias(hoje, limiteDeSeparacao(d.prazo, d.diasExpedicao) || d.prazo)))
        : null
    }
  };
};
