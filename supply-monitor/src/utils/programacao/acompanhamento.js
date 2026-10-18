import { diasUteisDaSemana } from './semana';

// Acompanhamento da programação: compara o que foi PUBLICADO para a
// semana com o que o WMS mostra hoje.
//
// Não lê o PDF. O PDF é imagem — não tem texto dentro — e, mesmo que
// tivesse, a versão publicada já está inteira no banco, RM por RM. Ler de
// lá é exato; ler do papel seria adivinhação.
//
// A escada de estados segue a régua que o depósito usa: o trabalho da
// separação termina em CONFERIDO; a Expedição entra depois e prontifica,
// que é quando a STC ou a GTC aparece no pedido.

export const ESTADOS = {
  NAO_SEPARADO: 'NAO_SEPARADO',
  SEPARADO: 'SEPARADO',
  PRONTIFICADO: 'PRONTIFICADO',
  EXPEDIDO: 'EXPEDIDO',
  CANCELADO: 'CANCELADO',
  SUMIU: 'SUMIU'
};

export const ESTADO_INFO = {
  NAO_SEPARADO: { label: 'Não separada', descricao: 'Continua na fila — o depósito ainda não fez', tom: 'red', cumprido: false },
  SEPARADO: { label: 'Separada', descricao: 'Conferida e entregue à Expedição', tom: 'emerald', cumprido: true },
  PRONTIFICADO: { label: 'Prontificada', descricao: 'A Expedição já emitiu a STC ou GTC', tom: 'indigo', cumprido: true },
  EXPEDIDO: { label: 'Expedida', descricao: 'Saiu do depósito', tom: 'slate', cumprido: true },
  CANCELADO: { label: 'Cancelada', descricao: 'Cancelada no WMS depois de programada', tom: 'amber', cumprido: false },
  SUMIU: { label: 'Fora da base', descricao: 'Não consta mais no WMS', tom: 'amber', cumprido: false }
};

const estadoDaRm = (info) => {
  if (!info) return ESTADOS.SUMIU;
  const s = info.situacao;
  if (s === 'CANCELADO') return ESTADOS.CANCELADO;
  if (s === 'EXPEDIDO') return ESTADOS.EXPEDIDO;
  // Conferida é o fim do trabalho do depósito. Se além disso já tem
  // documento, a Expedição também fez a parte dela.
  if (s === 'CONFERIDO') return info.documento ? ESTADOS.PRONTIFICADO : ESTADOS.SEPARADO;
  return ESTADOS.NAO_SEPARADO;
};

export const analisarAndamento = ({ snapshot, indiceWms, semanaRef }) => {
  if (!snapshot || !indiceWms) return null;
  const dias = diasUteisDaSemana(semanaRef);
  const primeiro = dias[0];
  const ultimo = dias[4];

  const planejadas = new Map();
  snapshot.grade.forEach(slot => {
    slot.alocacoes.forEach(a => planejadas.set(a.rm, { ...a, diaProgramado: slot.dia }));
  });

  const porEstado = Object.fromEntries(Object.values(ESTADOS).map(e => [e, []]));
  const porDia = new Map(dias.map(d => [d, { dia: d, planejado: 0, cumprido: 0 }]));
  const porCam = new Map();

  planejadas.forEach((plano, rm) => {
    const info = indiceWms.get(rm);
    const estado = estadoDaRm(info);
    const cumprido = ESTADO_INFO[estado].cumprido;
    const linha = {
      rm,
      cam: plano.cam || info?.cam || '(sem CAM)',
      diaProgramado: plano.diaProgramado,
      origem: plano.origem,
      justificativa: plano.justificativa,
      estado,
      documento: info?.documento || '',
      movimento: info?.movimento || null
    };
    porEstado[estado].push(linha);

    const d = porDia.get(plano.diaProgramado);
    if (d) { d.planejado++; if (cumprido) d.cumprido++; }

    const cam = linha.cam;
    if (!porCam.has(cam)) porCam.set(cam, { cam, planejado: 0, cumprido: 0, pendente: 0 });
    const c = porCam.get(cam);
    c.planejado++;
    if (cumprido) c.cumprido++; else c.pendente++;
  });

  // Separado fora do plano: RMs que não estavam na programação mas foram
  // trabalhadas dentro da semana. Aproximação honesta — o WMS não guarda
  // a data em que a RM foi conferida depois que ela é expedida, então uma
  // RM separada nesta semana e expedida numa semana seguinte aparece lá,
  // não aqui.
  const aMais = [];
  indiceWms.forEach(info => {
    if (planejadas.has(info.rm)) return;
    if (!info.movimento || info.movimento < primeiro || info.movimento > ultimo) return;
    if (info.situacao !== 'CONFERIDO' && info.situacao !== 'EXPEDIDO') return;
    aMais.push({
      rm: info.rm,
      cam: info.cam || '(sem CAM)',
      estado: estadoDaRm(info),
      documento: info.documento || '',
      movimento: info.movimento
    });
  });
  aMais.sort((a, b) => a.movimento.localeCompare(b.movimento) || a.cam.localeCompare(b.cam));

  const totalPlanejado = planejadas.size;
  const cumpridas = Object.entries(porEstado)
    .filter(([e]) => ESTADO_INFO[e].cumprido)
    .reduce((acc, [, lista]) => acc + lista.length, 0);

  const camAMais = new Map();
  aMais.forEach(x => camAMais.set(x.cam, (camAMais.get(x.cam) || 0) + 1));

  return {
    dias,
    totalPlanejado,
    cumpridas,
    naoCumpridas: totalPlanejado - cumpridas,
    taxa: totalPlanejado ? Math.round((cumpridas / totalPlanejado) * 100) : 0,
    prontificadas: porEstado[ESTADOS.PRONTIFICADO].length + porEstado[ESTADOS.EXPEDIDO].length,
    porEstado,
    porDia: Array.from(porDia.values()),
    porCam: Array.from(porCam.values())
      .map(c => ({ ...c, aMais: camAMais.get(c.cam) || 0 }))
      .sort((a, b) => b.planejado - a.planejado),
    aMais,
    camsSoAMais: Array.from(camAMais.entries())
      .filter(([cam]) => !porCam.has(cam))
      .map(([cam, qtd]) => ({ cam, planejado: 0, cumprido: 0, pendente: 0, aMais: qtd }))
  };
};
