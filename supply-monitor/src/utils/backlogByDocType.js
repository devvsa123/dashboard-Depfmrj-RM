import { classifyStc } from '../hooks/useStcGtcAnalysis';

// A idade máxima aceitável de um pedido em aberto depende do documento:
// STC vai para outro estado via outra OM, GTC é entrega local, e pedidos
// que ainda não têm nenhum dos dois estão no começo do fluxo. Por isso o
// "pedido mais antigo" são 3 metas separadas, não uma média única que
// mistura os três casos. Usado no painel de Metas e no relatório em PDF.
export const OLDEST_DOC_GROUPS = [
  { key: 'STC', label: 'Mais Antigo — STC', goalKey: 'oldestStcTarget' },
  { key: 'GTC', label: 'Mais Antigo — GTC', goalKey: 'oldestGtcTarget' },
  { key: 'NONE', label: 'Mais Antigo — Sem Documento', goalKey: 'oldestNoDocTarget' }
];

export const groupOldestByDocType = (pendingOrders, goals) => {
  const buckets = { STC: [], GTC: [], NONE: [] };
  (pendingOrders || []).forEach(p => {
    buckets[classifyStc(p.STC) || 'NONE'].push(p);
  });
  return OLDEST_DOC_GROUPS.map(({ key, label, goalKey }) => {
    const list = buckets[key];
    const target = goals[goalKey];
    const oldest = list.length ? Math.max(...list.map(p => p.daysOpen)) : null;
    const acimaDaMeta = list.filter(p => p.daysOpen > target).sort((a, b) => b.daysOpen - a.daysOpen);
    return { key, label, target, oldest, emAberto: list.length, acimaDaMeta };
  });
};
