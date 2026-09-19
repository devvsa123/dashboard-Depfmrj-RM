import { useState } from 'react';

const STORAGE_KEY = 'supplyGoals';

const DEFAULT_GOALS = {
  // SLA é sempre por tipo de documento (STC/GTC têm prazos bem diferentes
  // — ver useStcGtcAnalysis), nunca um "geral" misturando os dois.
  maxBacklogAge: 15,      // dias — idade média aceitável da fila
  maxOldestOrder: 30,     // dias — idade máxima aceitável do pedido mais antigo (visão geral, usada nos Riscos e Alertas)
  stcSlaTarget: 90,       // % de pedidos com STC expedidos até o prazo
  gtcSlaTarget: 90,       // % de pedidos com GTC expedidos até o prazo
  oldestStcTarget: 60,     // dias — idade máxima aceitável do pedido mais antigo com STC
  oldestGtcTarget: 15,     // dias — idade máxima aceitável do pedido mais antigo com GTC
  oldestNoDocTarget: 10    // dias — idade máxima aceitável do pedido mais antigo sem STC nem GTC
};

// Metas gerenciais editáveis pelo usuário, persistidas no navegador.
export const useGoals = () => {
  const [goals, setGoals] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_GOALS, ...JSON.parse(saved) } : DEFAULT_GOALS;
    } catch {
      return DEFAULT_GOALS;
    }
  });

  const updateGoals = (updates) => {
    setGoals(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { goals, updateGoals };
};
