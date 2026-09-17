import { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Envia um resumo executivo dos indicadores atuais para o Gemini e devolve
// um diagnóstico operacional em texto corrido.
export const useAiConsultant = ({ chartData, selectionSummary, slaAnalysis, backlogAnalysis, interfaceAnalysis }) => {
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState("");

  const resetAiAnalysis = () => setAiAnalysis("");

  const analyzeWithAI = async () => {
    if (!chartData || chartData.length === 0 || isAnalyzing || !selectionSummary) return;
    setIsAnalyzing(true);
    setAiError("");
    setAiAnalysis("");
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Chave da API Gemini não configurada (VITE_GEMINI_API_KEY).");

      const totalEntradasHist = chartData.reduce((acc, curr) => acc + (curr.entradas || 0), 0);
      const totalSaidasHist = chartData.reduce((acc, curr) => acc + (curr.separacoes || 0), 0);
      const mediaHistoricaSaidas = chartData.length > 0 ? (totalSaidasHist / chartData.length).toFixed(2) : 0;
      const mediaLeadHistorico = chartData.length > 0 ? (chartData.reduce((acc, curr) => acc + (curr.leadTimeDaily || 0), 0) / chartData.length).toFixed(2) : 0;
      const resumoErrosInterface = interfaceAnalysis?.falhasInterface.length || 0;

      const userQuery = `Analise em formato executivo: Histórico Entradas ${totalEntradasHist}, Saídas ${totalSaidasHist}, Média ${mediaHistoricaSaidas}, Lead Time ${mediaLeadHistorico}. Período selecionado: Entradas ${selectionSummary.entradas}, Saídas ${selectionSummary.separacoes}, SLA ${slaAnalysis.taxaNoPrazo}%. Backlog: ${backlogAnalysis?.totalPending} pedidos. Interface: ${resumoErrosInterface} divergências.`;

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
      const result = await model.generateContent({
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: "Você é um consultor sênior de Supply Chain. Gere um diagnóstico operacional fluido, sem asteriscos ou tabelas, focado em ajudar o tomador de decisão. Use os rótulos originais: Entradas (Corte), Saídas (Corte), Nível de Serviço (Até 20 dias)." }] }
      });
      const rawText = result.response.text();
      setAiAnalysis(rawText.replace(/[#*`>-]/g, "").trim());
    } catch (err) {
      setAiError(err.message || "Erro ao conectar com a Inteligência Artificial.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return { aiAnalysis, isAnalyzing, aiError, analyzeWithAI, resetAiAnalysis };
};
