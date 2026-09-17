import { useMemo } from 'react';

// Deriva alertas operacionais concretos e o semáforo de saúde geral a partir
// dos mesmos números já exibidos no dashboard, comparados às metas do
// usuário (useGoals). Nenhum limiar extra escondido: os limiares "críticos"
// são sempre um múltiplo claro da própria meta.
export const useRiskAlerts = ({ backlogAnalysis, interfaceAnalysis, slaAnalysis, selectionSummary, stcGtcAnalysis, goals }) => {
  return useMemo(() => {
    const alerts = [];

    const slaAtual = Number(slaAnalysis?.taxaNoPrazo) || 0;
    if (slaAnalysis && backlogAnalysis) {
      if (slaAtual < goals.slaTarget - 20) {
        alerts.push({
          id: 'sla-critical',
          severity: 'critical',
          tab: 'dashboard',
          title: 'Nível de serviço muito abaixo da meta',
          description: `SLA em ${slaAtual}% no período, contra meta de ${goals.slaTarget}%.`
        });
      } else if (slaAtual < goals.slaTarget) {
        alerts.push({
          id: 'sla-warning',
          severity: 'warning',
          tab: 'dashboard',
          title: 'Nível de serviço abaixo da meta',
          description: `SLA em ${slaAtual}% no período, contra meta de ${goals.slaTarget}%.`
        });
      }
    }

    const avgAge = Number(backlogAnalysis?.avgAge) || 0;
    if (backlogAnalysis && backlogAnalysis.totalPending > 0) {
      if (avgAge > goals.maxBacklogAge * 2) {
        alerts.push({
          id: 'backlog-age-critical',
          severity: 'critical',
          tab: 'backlog',
          title: 'Fila envelhecendo muito acima da meta',
          description: `Idade média de ${avgAge} dias, contra meta de ${goals.maxBacklogAge} dias.`
        });
      } else if (avgAge > goals.maxBacklogAge) {
        alerts.push({
          id: 'backlog-age-warning',
          severity: 'warning',
          tab: 'backlog',
          title: 'Fila acima da idade média ideal',
          description: `Idade média de ${avgAge} dias, contra meta de ${goals.maxBacklogAge} dias.`
        });
      }
    }

    const oldest = backlogAnalysis?.oldestOrder?.daysOpen || 0;
    if (backlogAnalysis?.oldestOrder) {
      if (oldest > goals.maxOldestOrder * 1.5) {
        alerts.push({
          id: 'oldest-order-critical',
          severity: 'critical',
          tab: 'backlog',
          title: 'Pedido crítico parado há muito tempo',
          description: `Pedido ${backlogAnalysis.oldestOrder.PEDIDO || backlogAnalysis.oldestOrder.PI || 'S/N'} aberto há ${oldest} dias (meta: até ${goals.maxOldestOrder}).`
        });
      } else if (oldest > goals.maxOldestOrder) {
        alerts.push({
          id: 'oldest-order-warning',
          severity: 'warning',
          tab: 'backlog',
          title: 'Pedido mais antigo acima da meta',
          description: `Pedido mais antigo com ${oldest} dias em aberto (meta: até ${goals.maxOldestOrder}).`
        });
      }
    }

    const falhas = interfaceAnalysis?.falhasInterface?.length || 0;
    const totalPending = backlogAnalysis?.totalPending || 0;
    if (falhas > 0) {
      alerts.push({
        id: 'interface-mismatch',
        severity: totalPending > 0 && falhas > totalPending ? 'critical' : 'warning',
        tab: 'interface',
        title: 'Divergências entre WMS e SINGRA',
        description: `${falhas} pedido(s) com status incompatível entre os dois sistemas.`
      });
    }

    if (selectionSummary && selectionSummary.balanco < 0) {
      alerts.push({
        id: 'balanco-negativo',
        severity: 'warning',
        tab: 'dashboard',
        title: 'Fila crescendo no período selecionado',
        description: `Saídas ficaram ${Math.abs(selectionSummary.balanco)} unidade(s) abaixo das entradas.`
      });
    }

    // Taxa de conclusão de documentos STC/GTC: quantos dos documentos (não
    // dos pedidos) já foram 100% expedidos, comparado à meta do usuário.
    stcGtcAnalysis?.documents?.forEach(doc => {
      if (doc.completionRate == null) return;
      const label = doc.type === 'STC' ? 'STC' : 'GTC';
      if (doc.completionRate < goals.docCompletionTarget - 20) {
        alerts.push({
          id: `doc-completion-critical-${doc.type}`,
          severity: 'critical',
          tab: 'dashboard',
          title: `Conclusão de ${label} muito abaixo da meta`,
          description: `Apenas ${doc.completionRate}% dos documentos ${label} estão totalmente concluídos, contra meta de ${goals.docCompletionTarget}%.`
        });
      } else if (doc.completionRate < goals.docCompletionTarget) {
        alerts.push({
          id: `doc-completion-warning-${doc.type}`,
          severity: 'warning',
          tab: 'dashboard',
          title: `Conclusão de ${label} abaixo da meta`,
          description: `${doc.completionRate}% dos documentos ${label} estão totalmente concluídos, contra meta de ${goals.docCompletionTarget}%.`
        });
      }
    });

    const severityRank = { critical: 2, warning: 1 };
    alerts.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);

    const health = alerts.some(a => a.severity === 'critical')
      ? 'critical'
      : alerts.some(a => a.severity === 'warning')
        ? 'warning'
        : 'good';

    return { alerts, health };
  }, [backlogAnalysis, interfaceAnalysis, slaAnalysis, selectionSummary, stcGtcAnalysis, goals]);
};
