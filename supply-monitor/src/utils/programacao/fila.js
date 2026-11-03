import { diffDias, hojeIso } from './semana';
import { TRATAMENTOS } from './rotas';

// -----------------------------------------------------------------------
// Análise da fila — o retrato do que está em processamento agora.
//
// Lê SÓ o arquivo do PWA com a situação das RMs (o mesmo que alimenta o
// resto da programação). Nada de SINGRA, nada de versão publicada: a
// pergunta aqui é "o que está na mão do depósito neste instante", e esse
// arquivo é atualizado com frequência alta.
//
// A fila é o MEIO do processo. Ficam fora:
//
//   Em planejamento        o pedido chegou e ainda não entrou em trabalho
//   Aguardando conferência está fora do giro da separação
//   Conferido              o depósito acabou; dali é Expedição
//   Expedido               saiu da casa
//   Cancelado              não existe mais — e não é mostrado em parte nenhuma
//
// Qualquer outra situação é fila. É de propósito que a regra seja por
// exclusão: quando o PWA passar a emitir uma situação nova, ela aparece
// na fila e na tabela de situações em vez de desaparecer da conta sem
// ninguém notar.
// -----------------------------------------------------------------------

// Situação comparável: maiúscula, sem acento, espaço colapsado. O arquivo
// alterna "EM SEPARACAO" e "Em Separação" entre exportações.
export const normalizarStatus = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toUpperCase()
  .replace(/\s+/g, ' ')
  .trim();

const FORA_EXATO = new Map([
  ['EM PLANEJAMENTO', 'Primeiro status: o pedido chegou e ainda não entrou em trabalho'],
  ['PLANEJAMENTO', 'Primeiro status: o pedido chegou e ainda não entrou em trabalho'],
  ['CONFERIDO', 'A separação terminou — daqui é trabalho da Expedição'],
  ['EXPEDIDO', 'Já saiu do depósito'],
  ['CANCELADO', 'Cancelada no WMS']
]);

// "Aguardando conferência" aparece com grafias diferentes entre
// exportações; o prefixo cobre todas sem precisar adivinhar cada uma.
const PREFIXO_AGUARDANDO = 'AGUARDANDO CONFER';
const MOTIVO_AGUARDANDO = 'Fora do giro da separação';

export const motivoDeFicarFora = (situacao) => {
  const s = normalizarStatus(situacao);
  if (!s) return 'Linha sem situação no arquivo';
  if (s.startsWith(PREFIXO_AGUARDANDO)) return MOTIVO_AGUARDANDO;
  return FORA_EXATO.get(s) || null;
};

export const estaNaFilaDeProcessamento = (situacao) => motivoDeFicarFora(situacao) === null;

export const CANCELADO = 'CANCELADO';

export const FAIXAS = [
  { label: 'Até 7 dias', min: 0, max: 7 },
  { label: '8 a 15 dias', min: 8, max: 15 },
  { label: '16 a 30 dias', min: 16, max: 30 },
  { label: '31 a 60 dias', min: 31, max: 60 },
  { label: 'Mais de 60 dias', min: 61, max: Infinity }
];

const media = (lista) => (lista.length ? Math.round(lista.reduce((t, n) => t + n, 0) / lista.length) : null);

const mediana = (lista) => {
  if (!lista.length) return null;
  const ordenada = [...lista].sort((a, b) => a - b);
  const meio = Math.floor(ordenada.length / 2);
  return ordenada.length % 2 ? ordenada[meio] : Math.round((ordenada[meio - 1] + ordenada[meio]) / 2);
};

const pct = (parte, total) => (total ? parseFloat(((parte / total) * 100).toFixed(1)) : 0);

// Idade da RM na fila: dias desde a liberação (DATA_ENTRADA), que é a
// data pela qual o WMS ordena a reserva. Sem ela não há idade — e isso é
// dito, não chutado.
const idadeDe = (entrada, hoje) => (entrada ? Math.max(0, diffDias(entrada, hoje)) : null);

export const analisarFila = ({ indiceWms, hoje = hojeIso(), capacidadeSemana = null, porCam = null }) => {
  if (!indiceWms || indiceWms.size === 0) return null;

  const linhas = [];
  const fora = new Map();
  let totalNoArquivo = 0;

  indiceWms.forEach(info => {
    totalNoArquivo++;
    const motivo = motivoDeFicarFora(info.situacao);
    if (motivo !== null) {
      const chave = normalizarStatus(info.situacao) || '(sem situação)';
      if (!fora.has(chave)) fora.set(chave, { status: chave, motivo, qtd: 0 });
      fora.get(chave).qtd++;
      return;
    }
    const config = porCam?.get(info.cam) || null;
    linhas.push({
      rm: info.rm,
      cam: info.cam || '(sem CAM)',
      sigla: config?.sigla || info.cam || '(sem CAM)',
      tratamento: config?.tratamento || TRATAMENTOS.PENDENTE,
      status: normalizarStatus(info.situacao),
      entrada: info.entrada || null,
      dias: idadeDe(info.entrada, hoje),
      movimento: info.movimento || null,
      documento: info.documento || '',
      tipoRm: info.tipoRm || '',
      reemitida: Boolean(info.reemitida)
    });
  });

  // Mais antiga em cima: é a ordem em que a fila deve ser atacada e a
  // ordem em que o WMS mostra a reserva.
  linhas.sort((a, b) => {
    if (a.entrada && b.entrada && a.entrada !== b.entrada) return a.entrada.localeCompare(b.entrada);
    if (a.entrada && !b.entrada) return -1;
    if (!a.entrada && b.entrada) return 1;
    return String(a.rm).localeCompare(String(b.rm));
  });

  const total = linhas.length;
  const idades = linhas.map(l => l.dias).filter(d => d != null);

  const agrupar = (chave) => {
    const mapa = new Map();
    linhas.forEach(l => {
      const k = chave(l);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(l);
    });
    return mapa;
  };

  const porStatus = Array.from(agrupar(l => l.status).entries())
    .map(([status, lista]) => {
      const idadesDoGrupo = lista.map(l => l.dias).filter(d => d != null);
      return {
        status,
        qtd: lista.length,
        pct: pct(lista.length, total),
        mediaDias: media(idadesDoGrupo),
        maiorEspera: idadesDoGrupo.length ? Math.max(...idadesDoGrupo) : null
      };
    })
    .sort((a, b) => b.qtd - a.qtd);

  const porCliente = Array.from(agrupar(l => l.cam).entries())
    .map(([cam, lista]) => {
      const idadesDoGrupo = lista.map(l => l.dias).filter(d => d != null);
      const porSituacao = {};
      lista.forEach(l => { porSituacao[l.status] = (porSituacao[l.status] || 0) + 1; });
      return {
        cam,
        sigla: lista[0].sigla,
        tratamento: lista[0].tratamento,
        qtd: lista.length,
        pct: pct(lista.length, total),
        mediaDias: media(idadesDoGrupo),
        maiorEspera: idadesDoGrupo.length ? Math.max(...idadesDoGrupo) : null,
        porStatus: porSituacao,
        rms: lista
      };
    })
    .sort((a, b) => b.qtd - a.qtd);

  const faixas = FAIXAS.map(f => {
    const lista = linhas.filter(l => l.dias != null && l.dias >= f.min && l.dias <= f.max);
    return { ...f, qtd: lista.length, pct: pct(lista.length, total) };
  });

  const comIdade = linhas.filter(l => l.dias != null);
  const maisAntiga = comIdade.length ? comIdade[0] : null;

  const foraDaFila = Array.from(fora.values()).sort((a, b) => b.qtd - a.qtd);

  return {
    hoje,
    total,
    totalNoArquivo,
    foraDaFila,
    totalForaDaFila: foraDaFila.reduce((t, f) => t + f.qtd, 0),
    canceladas: foraDaFila.find(f => f.status === CANCELADO)?.qtd || 0,
    cams: porCliente.length,
    semData: linhas.filter(l => l.dias == null).length,
    reemitidas: linhas.filter(l => l.reemitida).length,
    mediaDias: media(idades),
    medianaDias: mediana(idades),
    maisAntiga,
    // Quantas semanas de trabalho a fila representa, na vazão medida. É
    // a conta que diz se a fila está sendo vencida ou só administrada.
    semanasParaZerar: capacidadeSemana ? parseFloat((total / capacidadeSemana).toFixed(1)) : null,
    capacidadeSemana,
    porStatus,
    porCliente,
    faixas,
    linhas
  };
};
