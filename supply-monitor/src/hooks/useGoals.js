import { useState } from 'react';

const STORAGE_KEY = 'supplyGoals';

const DEFAULT_GOALS = {
  slaTarget: 90,          // % de pedidos expedidos até o prazo (meta mínima)
  maxBacklogAge: 15,      // dias — idade média aceitável da fila
  maxOldestOrder: 30,     // dias — idade máxima aceitável do pedido mais antigo
  stcSlaTarget: 90,       // % de pedidos com STC expedidos até o prazo
  gtcSlaTarget: 90,       // % de pedidos com GTC expedidos até o prazo
  docCompletionTarget: 70 // % mínimo de documentos (STC ou GTC) totalmente concluídos
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
