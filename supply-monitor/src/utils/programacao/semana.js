// Aritmética de semana e de dias úteis usada pela programação.
// Tudo trabalha com data em ISO (AAAA-MM-DD) e sem fuso: a programação é
// de dia de calendário, então converter para Date com hora traria o risco
// clássico de "virar o dia" dependendo do fuso do navegador.

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const isoParaPartes = (iso) => {
  const [a, m, d] = String(iso).split('-').map(Number);
  return { ano: a, mes: m, dia: d };
};

// Date em UTC, para que getUTCDay() não dependa do fuso de quem abre.
export const isoParaDate = (iso) => {
  const { ano, mes, dia } = isoParaPartes(iso);
  return new Date(Date.UTC(ano, mes - 1, dia));
};

export const dateParaIso = (date) => date.toISOString().split('T')[0];

export const hojeIso = () => dateParaIso(new Date());

export const diaDaSemana = (iso) => isoParaDate(iso).getUTCDay();

export const ehDiaUtil = (iso) => {
  const d = diaDaSemana(iso);
  return d >= 1 && d <= 5;
};

export const somaDias = (iso, n) => {
  const d = isoParaDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return dateParaIso(d);
};

// Anda n dias ÚTEIS a partir de uma data (n negativo anda para trás). O dia
// de partida não é contado.
export const somaDiasUteis = (iso, n) => {
  if (n === 0) return iso;
  const passo = n > 0 ? 1 : -1;
  let restam = Math.abs(n);
  let atual = iso;
  while (restam > 0) {
    atual = somaDias(atual, passo);
    if (ehDiaUtil(atual)) restam--;
  }
  return atual;
};

// Segunda-feira da semana de uma data qualquer.
export const segundaDaSemana = (iso) => {
  const d = diaDaSemana(iso);
  // Domingo (0) pertence à semana que já passou; joga para a segunda seguinte.
  const desloc = d === 0 ? 1 : 1 - d;
  return somaDias(iso, desloc);
};

// Os cinco dias úteis da semana que contém a data.
export const diasUteisDaSemana = (isoQualquer) => {
  const segunda = segundaDaSemana(isoQualquer);
  return [0, 1, 2, 3, 4].map(n => somaDias(segunda, n));
};

export const formatarBr = (iso) => {
  if (!iso) return '—';
  const { ano, mes, dia } = isoParaPartes(iso);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
};

export const formatarCurto = (iso) => {
  if (!iso) return '—';
  const { mes, dia } = isoParaPartes(iso);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
};

export const rotuloSemana = (isoQualquer) => {
  const dias = diasUteisDaSemana(isoQualquer);
  return `${formatarBr(dias[0])} a ${formatarBr(dias[4])}`;
};

// Diferença em dias corridos (b - a).
export const diffDias = (a, b) => Math.round((isoParaDate(b) - isoParaDate(a)) / 86400000);
