import { formatarBr, diffDias } from './semana';
import { prazoDaRota, TRATAMENTOS } from './rotas';

// A régua de prioridade, única para a separação e para a Expedição.
//
// A pergunta que ela responde é sempre a mesma: separei (ou conferi) 17
// CAMs hoje — qual atacar primeiro? O pedido mais antigo que está longe
// da janela, ou o CAM que tem mensagem com prazo?
//
// A resposta é por DATA-LIMITE, não por categoria. Cada RM carrega a
// data em que ela deixa de ser atendível a tempo:
//
//   forçado  — o programador mandou; é emergência e fura a fila
//   prazo    — a data da mensagem, descontado o tempo de expedição
//   rota     — a véspera útil da saída do CAM
//   janela   — a véspera útil da abertura (ou o fim) da janela do CDAM
//   fila     — não tem limite; entra por antiguidade
//
// Ordenar por essa data resolve o caso difícil sem regra especial: uma
// mensagem com prazo daqui a três semanas perde para uma rota que sai
// amanhã, porque perder o caminhão de amanhã custa uma semana inteira e
// a mensagem ainda tem folga. E o contrário também vale.

export const MOTIVOS = {
  FORCADO: { key: 'FORCADO', label: 'Forçado pelo programador', curto: 'FORÇADO', tom: 'violet' },
  PRAZO:   { key: 'PRAZO',   label: 'Prazo de mensagem',        curto: 'PRAZO',   tom: 'indigo' },
  ROTA:    { key: 'ROTA',    label: 'Rota do CAM',              curto: 'ROTA',    tom: 'emerald' },
  JANELA:  { key: 'JANELA',  label: 'Janela do CDAM',           curto: 'JANELA',  tom: 'amber' },
  FILA:    { key: 'FILA',    label: 'Fila por antiguidade',     curto: 'FILA',    tom: 'slate' }
};

// A urgência de uma RM: por que ela é urgente e até quando.
// `rota` é o retorno de prazoDaRota; `prazo` é o limite da demanda.
export const urgenciaDe = ({ forcado, prazoLimite, rota, entrada, diasEmFila }) => {
  if (forcado) {
    return { motivo: MOTIVOS.FORCADO, limite: null, forcado: true, texto: 'Atendimento forçado pelo programador', entrada, diasEmFila };
  }
  if (prazoLimite) {
    return { motivo: MOTIVOS.PRAZO, limite: prazoLimite, texto: `Prazo de mensagem — concluir até ${formatarBr(prazoLimite)}`, entrada, diasEmFila };
  }
  if (rota) {
    const motivo = rota.tipo === 'GTC' ? MOTIVOS.ROTA : MOTIVOS.JANELA;
    const texto = rota.tipo === 'GTC'
      ? `Rota do CAM em ${formatarBr(rota.saida)} — concluir até ${formatarBr(rota.conferirAte)}`
      : `Janela do CDAM até ${formatarBr(rota.janela.fim)} — concluir até ${formatarBr(rota.conferirAte)}`;
    return { motivo, limite: rota.conferirAte, rota, texto, entrada, diasEmFila };
  }
  return {
    motivo: MOTIVOS.FILA,
    limite: null,
    texto: diasEmFila != null ? `Fila por antiguidade — ${diasEmFila} dias de espera` : 'Fila por antiguidade',
    entrada,
    diasEmFila
  };
};

// Ordem de atendimento. Forçado no topo; depois quem vence primeiro;
// quem não tem limite entra por antiguidade, no fim.
export const porUrgencia = (a, b) => {
  if (Boolean(a.forcado) !== Boolean(b.forcado)) return a.forcado ? -1 : 1;
  if (a.limite && b.limite && a.limite !== b.limite) return a.limite.localeCompare(b.limite);
  if (a.limite && !b.limite) return -1;
  if (!a.limite && b.limite) return 1;
  if (a.entrada && b.entrada && a.entrada !== b.entrada) return a.entrada.localeCompare(b.entrada);
  if (a.entrada && !b.entrada) return -1;
  if (!a.entrada && b.entrada) return 1;
  return 0;
};

// O que forçar um CAM custa, em termos que o programador reconhece.
//
// O ponto desta função é não esconder a parte ruim: forçar um CAM de STC
// cuja janela fechou ontem põe o material pronto no pátio para esperar a
// janela seguinte. Pode ser exatamente o que se quer — demanda
// emergencial sai da lógica normal — mas a conta precisa estar à vista.
export const impactoDeForcar = ({ cam, config, rmsDoCam, capacidadeSemana, hoje, primeiroDia }) => {
  const qtd = rmsDoCam.length;
  const rota = prazoDaRota(config, primeiroDia || hoje);
  const ocupacao = capacidadeSemana ? Math.round((qtd / capacidadeSemana) * 100) : null;

  let entrega = null;
  if (!config || config.tratamento === TRATAMENTOS.PENDENTE) {
    entrega = { tom: 'amber', texto: 'CAM ainda sem rota cadastrada: não dá para dizer quando o material sai daqui.' };
  } else if (config.tratamento === TRATAMENTOS.OCULTO) {
    entrega = { tom: 'amber', texto: 'CAM marcado como oculto no cadastro. Confirme se ele voltou a ser atendido.' };
  } else if (!rota) {
    entrega = { tom: 'amber', texto: 'CAM sem dia de rota ou sem janela definida: o material fica pronto sem data de saída.' };
  } else if (rota.tipo === 'GTC') {
    entrega = { tom: 'emerald', texto: `A próxima saída deste CAM é ${formatarBr(rota.saida)}. Separando até ${formatarBr(rota.conferirAte)}, o material pega essa rota.` };
  } else {
    const esperaria = diffDias(hoje, rota.janela.inicio);
    entrega = esperaria > 0
      ? { tom: 'amber', texto: `A janela do CDAM para este CAM só abre em ${formatarBr(rota.janela.inicio)}. O material vai ficar pronto e esperar ${esperaria} dia(s) pela retirada.` }
      : { tom: 'emerald', texto: `A janela do CDAM está aberta até ${formatarBr(rota.janela.fim)}. Separando até ${formatarBr(rota.conferirAte)}, a STC ainda entra nela.` };
  }

  return { cam, qtd, ocupacao, rota, entrega };
};
