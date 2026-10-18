// Extração de RMs de texto colado. O programador copia a relação de uma
// mensagem SIGAD, de um e-mail ou de uma conversa — o formato varia e não
// vale a pena tentar interpretar o documento inteiro. O que não varia é o
// número da RM, então é só isso que a gente procura.
//
// Na mensagem SIGAD a RM vem como "15.757.540"; em outros meios vem como
// "15757540". Os dois casam com a mesma regex, que é a mesma já usada na
// Busca por E-mail do dashboard.
const RM_REGEX = /\b(\d{2}\.\d{3}\.\d{3}|\d{8})\b/g;

export const extrairRms = (texto) => {
  if (!texto) return { rms: [], duplicadas: 0, totalEncontrado: 0 };
  const achados = String(texto).match(RM_REGEX) || [];
  const limpos = achados.map(m => m.replace(/\./g, ''));
  const vistos = new Set();
  const rms = [];
  let duplicadas = 0;
  limpos.forEach(rm => {
    if (vistos.has(rm)) { duplicadas++; return; }
    vistos.add(rm);
    rms.push(rm);
  });
  return { rms, duplicadas, totalEncontrado: achados.length };
};

// Confere cada RM colada contra o WMS. O programador precisa saber, ANTES
// de programar, que uma RM da mensagem já saiu, foi cancelada ou nem
// existe na base — senão ele programa trabalho que não existe e descobre
// no meio da semana.
export const SITUACOES = {
  EM_FILA: 'EM_FILA',
  CONFERIDA: 'CONFERIDA',
  JA_EXPEDIDA: 'JA_EXPEDIDA',
  CANCELADA: 'CANCELADA',
  NAO_ENCONTRADA: 'NAO_ENCONTRADA'
};

export const SITUACAO_LABEL = {
  EM_FILA: 'Em fila — será programada',
  CONFERIDA: 'Já conferida — com a Expedição',
  JA_EXPEDIDA: 'Já expedida — nada a fazer',
  CANCELADA: 'Cancelada no WMS',
  NAO_ENCONTRADA: 'Não encontrada no WMS'
};

export const conferirRms = (rms, indiceWms) => {
  const resultado = Object.fromEntries(Object.values(SITUACOES).map(k => [k, []]));
  rms.forEach(rm => {
    const info = indiceWms.get(rm);
    if (!info) { resultado[SITUACOES.NAO_ENCONTRADA].push({ rm }); return; }
    // CONFERIDA já está pronta e com a Expedição: o depósito não tem mais
    // o que separar nela, então ela não entra na programação.
    if (info.situacao === 'CONFERIDO') { resultado[SITUACOES.CONFERIDA].push({ rm, ...info }); return; }
    if (info.situacao === 'EXPEDIDO') { resultado[SITUACOES.JA_EXPEDIDA].push({ rm, ...info }); return; }
    if (info.situacao === 'CANCELADO') { resultado[SITUACOES.CANCELADA].push({ rm, ...info }); return; }
    resultado[SITUACOES.EM_FILA].push({ rm, ...info });
  });
  return resultado;
};
