// Interpreta a NOMENCLATURA do WMS, que segue o padrão
// "PEÇA + atributos + tamanho" (ex: "GANDOLA OPERATIVA AZUL-FERRETE G",
// "SAPATO PRETO COM CADARCO 42"). São milhares de nomenclaturas distintas,
// então a análise só fica legível agrupando — e é isso que este arquivo
// resolve, quebrando cada nome em três níveis:
//
//   família  = a peça em si (1ª palavra): CALCA, GANDOLA, SAPATO...
//   linha    = o modelo, sem a peça e sem o tamanho: é o que junta a calça,
//              a gandola e o gorro do mesmo CONJUNTO CAMUFLADO MULTI
//              PROPOSITO numa linha só.
//   grade    = a nomenclatura sem o tamanho: junta os tamanhos 35 a 54 do
//              mesmo sapato num item só.
//
// O tamanho sai separado, para dar para olhar a grade por dentro.

// Tamanhos de letra usados no fardamento. Os numéricos entram pela faixa
// (30 a 70 cobre numeração de calçado e de peça).
const TAMANHOS_LETRA = new Set(['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', 'XXG', 'EG', 'EGG']);

const ehTamanho = (token) => {
  if (TAMANHOS_LETRA.has(token)) return true;
  if (/^\d{2}$/.test(token)) {
    const n = Number(token);
    return n >= 30 && n <= 70;
  }
  return false;
};

// Erros de digitação que aparecem na base e quebrariam o agrupamento (a
// mesma peça viraria dois grupos). Chave e valor já normalizados. É uma
// lista pequena e de manutenção manual de propósito: corrigir no WMS é
// sempre melhor do que remendar aqui.
const CORRECOES = {
  CAMULFADO: 'CAMUFLADO'
};

export const normalizarNomenclatura = (bruto) =>
  String(bruto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// O parse é caro para rodar em toda linha da planilha (são mais de 100 mil),
// mas o número de nomenclaturas DISTINTAS é pequeno perto disso — por isso
// o resultado fica em cache por nome.
const cache = new Map();

export const parseNomenclatura = (bruto) => {
  const nome = normalizarNomenclatura(bruto);
  if (cache.has(nome)) return cache.get(nome);

  const tokens = nome.split(' ').filter(Boolean).map(t => CORRECOES[t] || t);

  const tamanhos = [];
  while (tokens.length > 1 && ehTamanho(tokens[tokens.length - 1])) {
    tamanhos.unshift(tokens.pop());
  }

  const familia = tokens[0] || 'SEM NOMENCLATURA';
  const grade = tokens.join(' ') || familia;
  const linha = tokens.slice(1).join(' ') || '(sem variação)';

  const parsed = {
    nome: nome || 'SEM NOMENCLATURA',
    familia,
    linha,
    grade,
    tamanho: tamanhos.join(' ') || '(único)'
  };
  cache.set(nome, parsed);
  return parsed;
};

// Curva ABC clássica: ordena os grupos por volume e classifica pelo
// acumulado — A até 80%, B até 95%, C o resto. É o que transforma "milhares
// de itens" em "uns poucos que explicam quase tudo".
export const classificarAbc = (grupos, campoVolume = 'entradas') => {
  const ordenados = [...grupos].sort((a, b) => b[campoVolume] - a[campoVolume]);
  const total = ordenados.reduce((acc, g) => acc + g[campoVolume], 0);
  let acumulado = 0;
  return ordenados.map(g => {
    acumulado += g[campoVolume];
    const participacao = total > 0 ? (g[campoVolume] / total) * 100 : 0;
    const acumuladoPct = total > 0 ? (acumulado / total) * 100 : 0;
    return {
      ...g,
      participacao: parseFloat(participacao.toFixed(1)),
      acumuladoPct: parseFloat(acumuladoPct.toFixed(1)),
      classeAbc: acumuladoPct <= 80 ? 'A' : acumuladoPct <= 95 ? 'B' : 'C'
    };
  });
};
