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

  // ── Agrupamento por CAM: um CAM ocupa UM dia da semana ────────────
  //
  // Regra dura, e por um motivo operacional, não teórico. Para pôr a
  // fila no WMS, o operador monta a capa de lote na tela AK050 marcando
  // pedido por pedido, e depois reserva a capa na AK300. A fila não se
  // corrige depois: para mudar qualquer coisa é preciso cancelar as
  // reservas e refazer tudo na ordem em que elas aparecem. Com o CAM
  // inteiro num dia só, cada cliente vira uma capa de lote montada de
  // uma vez — é a diferença entre caçar RMs soltas na tela e marcar um
  // bloco contíguo.
  //
  // O preço vem junto e sai escrito: o que não couber no dia do CAM não
  // escorre para outro dia, fica para a semana seguinte. Quem quiser
  // levar o CAM inteiro aumenta a capacidade daquele dia.
  const diaDoCam = new Map();
  const chaveDoCam = (cam) => (cam && String(cam).trim() ? String(cam).trim() : null);
  const sobraPorCam = new Map();
  const divididos = new Map();

  // A única exceção à regra: CAM que não cabe num dia inteiro. Aí não há
  // agrupamento possível — nem o maior dia da semana o comporta —, e
  // deixar o excedente de fora só desperdiçaria capacidade. Ele se
  // divide em dias seguidos, e isso sai escrito com a saída junto:
  // aumentar a capacidade de um dia junta o CAM de novo.
  const maiorDia = Math.max(0, ...grade.filter(g => !g.bloqueio).map(g => g.capacidade));

  const alocar = (dia, registro, permitirDivisao = false) => {
    const slot = porDia.get(dia);
    if (!slot || slot.restante <= 0) return false;
    const chave = chaveDoCam(registro.cam);
    // A regra vale para todo caminho de alocação, inclusive o forçado.
    if (chave && diaDoCam.has(chave) && diaDoCam.get(chave) !== dia && !permitirDivisao) return false;
    slot.alocacoes.push(registro);
    slot.restante--;
    if (chave && !diaDoCam.has(chave)) diaDoCam.set(chave, dia);
    jaAlocadas.add(registro.rm);
    return true;
  };

  // O dia de um bloco: o mais cedo em que ele caiba INTEIRO. Se não
  // couber em nenhum, o de maior sobra — leva o máximo possível de uma
  // vez, e o resto fica registrado.
  const diaParaBloco = (qtd, limite) => {
    const elegiveis = grade.filter(g => !g.bloqueio && g.restante > 0 && (!limite || g.dia <= limite));
    if (!elegiveis.length) return null;
    const inteiro = elegiveis.find(g => g.restante >= qtd);
    if (inteiro) return inteiro.dia;
    return elegiveis.reduce((a, b) => (b.restante > a.restante ? b : a)).dia;
  };

  // Agrupa por CAM preservando a ordem de chegada: o bloco do primeiro
  // CAM da lista continua sendo o primeiro a ser atendido. RM sem CAM
  // não agrupa com ninguém — não é cliente, é linha solta.
  const blocosPorCam = (itens) => {
    const mapa = new Map();
    itens.forEach(item => {
      const cam = chaveDoCam(item.cam);
      const chave = cam || `__sem_cam__${item.rm}`;
      if (!mapa.has(chave)) mapa.set(chave, { cam, itens: [] });
      mapa.get(chave).itens.push(item);
    });
    return Array.from(mapa.values());
  };

  const alocarBloco = ({ cam, itens, limite = null, registroDe, contarSobra = true }) => {
    if (!itens.length) return { dia: null, alocadas: [], sobra: [] };
    // Se o CAM já tem dia nesta semana, é nele — mesmo que outro dia
    // coubesse melhor. É isso que garante uma capa de lote por cliente.
    const dia = (cam && diaDoCam.get(cam)) || diaParaBloco(itens.length, limite) || diaParaBloco(itens.length, null);
    if (!dia) return { dia: null, alocadas: [], sobra: [...itens] };

    const alocadas = [];
    let sobra = [];
    itens.forEach(item => ((alocar(dia, registroDe(item, dia)) ? alocadas : sobra).push(item)));

    // Não coube tudo. Se o CAM for maior do que um dia inteiro da
    // semana, não existe dia que o comporte: divide em dias seguidos em
    // vez de deixar capacidade parada. Caso contrário o excedente fica
    // para a semana que vem, e o dia pode ser ampliado para juntá-lo.
    const diasUsados = [dia];
    if (sobra.length && cam && itens.length > maiorDia) {
      // Enche o dia mais vazio até o fim antes de abrir outro: cada dia
      // a mais é uma capa de lote a mais para montar na mão.
      const maisVazio = (candidatos) => (candidatos.length
        ? candidatos.reduce((a, b) => (b.restante > a.restante ? b : a))
        : null);
      const restantes = [...sobra];
      while (restantes.length) {
        const livres = grade.filter(g => !g.bloqueio && g.restante > 0 && g.dia !== dia);
        const outro = maisVazio(livres.filter(g => !limite || g.dia <= limite)) || maisVazio(livres);
        if (!outro) break;
        let coube = 0;
        while (restantes.length && outro.restante > 0 && alocar(outro.dia, registroDe(restantes[0], outro.dia), true)) {
          alocadas.push(restantes.shift());
          coube++;
        }
        if (!coube) break;
        if (!diasUsados.includes(outro.dia)) diasUsados.push(outro.dia);
      }
      sobra = restantes;
      if (diasUsados.length > 1) {
        divididos.set(cam, { cam, qtd: alocadas.length, dias: [...diasUsados].sort() });
      }
    }

    if (cam && contarSobra && sobra.length) sobraPorCam.set(cam, (sobraPorCam.get(cam) || 0) + sobra.length);
    return { dia, alocadas, sobra };
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
    let forcadas = 0;
    blocosPorCam(alvo).forEach(bloco => {
      const { alocadas, sobra } = alocarBloco({
        cam: bloco.cam,
        itens: bloco.itens,
        contarSobra: false,
        registroDe: (item) => ({ ...item, origem: 'FORCADO', justificativa: 'Atendimento forçado pelo programador' })
      });
      forcadas += alocadas.length;
      sobra.forEach(item => {
        naoCoube.set(item.cam, (naoCoube.get(item.cam) || 0) + 1);
        naoAlocadas.push({ ...item, justificativa: 'Atendimento forçado pelo programador', motivo: 'SEM_CAPACIDADE' });
      });
    });
    if (forcadas > 0) {
      alertas.push({
        nivel: 'atencao',
        texto: `${forcadas} RM(s) de ${Array.from(forcadosSet).join(', ')} foram programadas por ordem do programador, na frente da fila normal.`
      });
    }
    naoCoube.forEach((qtd, cam) => alertas.push({
      nivel: 'critico',
      texto: `${qtd} RM(s) de ${cam} foram forçadas mas não cabem no dia do CAM (${formatarBr(diaDoCam.get(chaveDoCam(cam)) || dias[0])}). Aumente a capacidade desse dia para levar o CAM inteiro.`
    }));
  }

  // ── Fila 1: demandas com prazo, da mais apertada para a mais folgada ──
  const comPrazo = demandas
    .filter(d => d.prazo)
    .sort((a, b) => a.prazo.localeCompare(b.prazo));
  const semPrazo = demandas.filter(d => !d.prazo);

  const processaDemanda = (demanda, limite) => {
    const pendentes = [];
    (demanda.rms || []).forEach(item => {
      const rm = typeof item === 'string' ? item : item.rm;
      if (jaAlocadas.has(rm)) return;
      pendentes.push(typeof item === 'string' ? { rm } : item);
    });

    const justificativa = demanda.prazo
      ? `${demanda.referencia || demanda.origemLabel} — prazo ${formatarBr(demanda.prazo)}`
      : (demanda.referencia || demanda.origemLabel);

    const nome = demanda.referencia || demanda.origemLabel;
    const sobrou = [];
    const semDia = [];
    blocosPorCam(pendentes).forEach(bloco => {
      const { dia, sobra } = alocarBloco({
        cam: bloco.cam,
        itens: bloco.itens,
        limite,
        contarSobra: false,
        registroDe: (item) => ({ ...item, origem: demanda.origem, demandaId: demanda.id, justificativa, prazo: demanda.prazo || null })
      });
      // O CAM já tinha dia nesta semana e esse dia passa do limite da
      // demanda: o agrupamento ganhou, e isso precisa estar escrito.
      if (dia && limite && dia > limite) {
        alertas.push({
          nivel: 'critico',
          demandaId: demanda.id,
          texto: `${bloco.cam} já está programado em ${formatarBr(dia)} e as RMs de "${nome}" foram junto, depois do limite de ${formatarBr(limite)} (prazo ${formatarBr(demanda.prazo)}). O CAM inteiro vai num dia só.`
        });
      }
      if (sobra.length) {
        sobrou.push(...sobra);
        if (dia) {
          alertas.push({
            nivel: limite ? 'critico' : 'atencao',
            demandaId: demanda.id,
            texto: `${sobra.length} RM(s) de "${nome}" não couberam no dia do ${bloco.cam || 'CAM'} (${formatarBr(dia)}). Aumente a capacidade desse dia ou tire outro CAM dali — o CAM não se divide entre dias.`
          });
        } else {
          semDia.push(...sobra);
        }
      }
    });

    if (sobrou.length) {
      sobrou.forEach(item => naoAlocadas.push({ ...item, demandaId: demanda.id, justificativa, motivo: limite ? 'SEM_CAPACIDADE_ATE_O_PRAZO' : 'SEM_CAPACIDADE' }));
    }
    // Bloco que não achou dia nenhum: a semana (ou o trecho dela até o
    // prazo) está sem capacidade. É outro problema e tem outro aviso.
    if (semDia.length) {
      alertas.push({
        nivel: limite ? 'critico' : 'atencao',
        demandaId: demanda.id,
        texto: limite
          ? `${semDia.length} RM(s) de "${nome}" não cabem na capacidade até ${formatarBr(limite)} (prazo ${formatarBr(demanda.prazo)}).`
          : `${semDia.length} RM(s) de "${nome}" não couberam na semana.`
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

  // ── Fila 2: o resto da fila, por urgência, em blocos de CAM ──
  //
  // Antiguidade continua mandando em QUEM entra na semana. O cadastro de
  // rotas muda o DIA: separar na quinta o que sai na terça custa uma
  // semana inteira de espera na Expedição, porque o caminhão daquele CAM
  // já passou. Quem tem rota ou janela vencendo dentro da semana é
  // alocado antes do seu limite; o resto entra por antiguidade.
  //
  // A diferença para antes é a unidade: não se aloca RM, aloca-se o CAM
  // inteiro. A ordem entre blocos é a da RM mais urgente de cada um.
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
  blocosPorCam(comUrgencia).forEach(bloco => {
    // O limite do bloco é o mais apertado entre as RMs dele.
    const limite = bloco.itens.reduce(
      (menor, i) => (i.urgencia.limite && (!menor || i.urgencia.limite < menor) ? i.urgencia.limite : menor),
      null
    );
    const { dia, alocadas } = alocarBloco({
      cam: bloco.cam,
      itens: bloco.itens,
      limite,
      registroDe: (item, diaEscolhido) => (
        item.urgencia.limite && diaEscolhido <= item.urgencia.limite
          ? { ...item, origem: item.urgencia.motivo.key, justificativa: item.urgencia.texto }
          : {
            ...item,
            origem: 'FILA',
            justificativa: item.diasEmFila != null
              ? `Fila por antiguidade — ${item.diasEmFila} dias de espera`
              : 'Fila por antiguidade'
          }
      )
    });
    // Perdeu a rota: entrou na semana, mas depois do dia em que ainda
    // daria para pegar a saída do próprio CAM.
    if (dia && limite && dia > limite) perderamARota.push(...alocadas.filter(i => i.urgencia.limite));
  });

  // Quem não coube antes do próprio limite não some da semana: é
  // programado assim mesmo. Mas o programador precisa saber, porque é
  // material que vai ficar pronto e esperar a saída seguinte.
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

  // O que o agrupamento deixou de fora: RMs que caberiam na semana se
  // pudessem ir para outro dia, mas o CAM delas já tem dia marcado.
  // É o custo da regra, e ele é dito com nome e número — com a saída
  // junto, que é aumentar a capacidade daquele dia.
  // CAM maior que um dia inteiro: dividido por impossibilidade física.
  const camsDivididos = Array.from(divididos.values()).sort((a, b) => b.qtd - a.qtd);
  if (camsDivididos.length) {
    const listar = (itens) => (itens.length > 1
      ? `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
      : itens[0]);
    const texto = camsDivididos
      .map(d => `${d.cam} (${d.qtd} RMs em ${listar(d.dias.map(formatarBr))})`)
      .join('; ');
    alertas.push({
      nivel: 'atencao',
      texto: `${camsDivididos.length} CAM(s) não cabem num dia inteiro (o maior dia da semana tem ${maiorDia}) e foram divididos em mais de um dia: ${texto}. Para reservar o CAM de uma vez só, aumente a capacidade de um dia.`
    });
  }

  const sobras = Array.from(sobraPorCam.entries())
    .map(([cam, qtd]) => ({ cam, qtd, dia: diaDoCam.get(cam) || null }))
    .sort((a, b) => b.qtd - a.qtd);
  const totalSobra = sobras.reduce((t, s) => t + s.qtd, 0);
  if (totalSobra > 0 && grade.some(g => g.capacidade > 0)) {
    const primeiros = sobras.slice(0, 3).map(s => `${s.cam} (${s.qtd}${s.dia ? ` — dia ${formatarBr(s.dia)}` : ''})`).join(', ');
    alertas.push({
      nivel: 'atencao',
      texto: `${totalSobra} RM(s) de ${sobras.length} CAM(s) ficaram fora da semana porque o CAM vai inteiro num dia só e o dia dele encheu: ${primeiros}${sobras.length > 3 ? ` e mais ${sobras.length - 3}` : ''}. Para levar o CAM inteiro, aumente a capacidade do dia.`
    });
  }

  // ── A prestação de contas das grades de fornecimento ──────────────
  //
  // O programador precisa poder verificar, e não acreditar: para cada CAM
  // da semana, qual é a grade dele (dia de rota ou janela do CDAM), até
  // quando a separação tinha de terminar e até que dia ela de fato foi
  // programada. Quando o último dia passa do limite, o material vai ficar
  // pronto esperando a saída seguinte — e isso sai escrito, não implícito.
  const gradesConsideradas = [];
  if (rotas) {
    const porCamGrade = new Map();
    grade.forEach(slot => slot.alocacoes.forEach(a => {
      const cam = a.cam || '(sem CAM)';
      if (!porCamGrade.has(cam)) porCamGrade.set(cam, { cam, qtd: 0, ultimoDia: slot.dia });
      const r = porCamGrade.get(cam);
      r.qtd++;
      if (slot.dia > r.ultimoDia) r.ultimoDia = slot.dia;
    }));
    porCamGrade.forEach(r => {
      const config = rotas.get(r.cam);
      const rota = prazoDaRota(config, dias[0]);
      gradesConsideradas.push({
        cam: r.cam,
        sigla: config?.sigla || '',
        tratamento: config?.tratamento || 'PENDENTE',
        tipo: rota?.tipo || null,
        saida: rota?.saida || null,
        janelaInicio: rota?.janela?.inicio || null,
        limite: rota?.conferirAte || null,
        ultimoDia: r.ultimoDia,
        qtd: r.qtd,
        dentro: rota ? r.ultimoDia <= rota.conferirAte : null
      });
    });
    gradesConsideradas.sort((a, b) => {
      const peso = (x) => (x.dentro === null ? 1 : x.dentro ? 2 : 0);
      if (peso(a) !== peso(b)) return peso(a) - peso(b);
      if (a.saida && b.saida && a.saida !== b.saida) return a.saida.localeCompare(b.saida);
      return b.qtd - a.qtd;
    });
  }

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
    gradesConsideradas,
    // O custo do agrupamento, CAM por CAM: o que ficou fora da semana
    // porque o dia daquele CAM encheu.
    sobrasPorAgrupamento: sobras,
    camsDivididos,
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
      camsNoLimite: gradesConsideradas.filter(g => g.dentro === true).length,
      camsForaDoLimite: gradesConsideradas.filter(g => g.dentro === false).length,
      camsSemGrade: gradesConsideradas.filter(g => g.dentro === null).length,
      camsAtendidos: porCam.size,
      // Com o agrupamento, cada CAM ocupa exatamente um dia; estes dois
      // números dizem quanto isso custou nesta semana.
      sobraPorAgrupamento: totalSobra,
      camsComSobra: sobras.length,
      camsDivididos: camsDivididos.length,
      filaTotal: fila.length,
      reemitidasNaFila: fila.filter(f => f.reemitida).length,
      diasBloqueados: grade.filter(g => g.bloqueio).length,
      folgaAteOPrazo: comPrazo.length && hoje
        ? Math.min(...comPrazo.map(d => diffDias(hoje, limiteDeSeparacao(d.prazo, d.diasExpedicao) || d.prazo)))
        : null
    }
  };
};
