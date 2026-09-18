import { useState } from 'react';
import {
  Upload, Loader2, Activity, Clock, LayoutDashboard, Hourglass,
  RefreshCw, Network, Database, Search, AlertCircle, Users
} from 'lucide-react';
import { downloadExcel } from './utils/spreadsheet';
import { useSpreadsheetSync } from './hooks/useSpreadsheetSync';
import { useEmailExtractor } from './hooks/useEmailExtractor';
import { useDashboardAnalytics } from './hooks/useDashboardAnalytics';
import { useYoyAnalysis } from './hooks/useYoyAnalysis';
import { useBacklogAnalysis } from './hooks/useBacklogAnalysis';
import { useInterfaceAnalysis } from './hooks/useInterfaceAnalysis';
import { useAiConsultant } from './hooks/useAiConsultant';
import { useGoals } from './hooks/useGoals';
import { useRiskAlerts } from './hooks/useRiskAlerts';
import { useStcGtcAnalysis } from './hooks/useStcGtcAnalysis';
import { useRmTypeComparison } from './hooks/useRmTypeComparison';
import { useCamAnalysis } from './hooks/useCamAnalysis';
import { useTrendForecast } from './hooks/useTrendForecast';
import DashboardTab from './components/DashboardTab';
import BacklogTab from './components/BacklogTab';
import InterfaceTab from './components/InterfaceTab';
import EmailSearchTab from './components/EmailSearchTab';
import CamAnalysisTab from './components/CamAnalysisTab';
import HealthBadge from './components/HealthBadge';

const App = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedBucket, setSelectedBucket] = useState(null);
  const [selectedPiSegment, setSelectedPiSegment] = useState(null);
  const [bucketSearchTerm, setBucketSearchTerm] = useState("");

  const { data, singraData, fileName, loading, error, lastSync, performSync, handleFileUpload: syncFileUpload } = useSpreadsheetSync();

  const emailExtractor = useEmailExtractor(data, singraData);
  const dashboardAnalytics = useDashboardAnalytics(data);
  const yoyAnalysis = useYoyAnalysis(data);
  const backlogAnalysis = useBacklogAnalysis(data, singraData);
  const interfaceAnalysis = useInterfaceAnalysis(data, singraData);
  const ai = useAiConsultant({
    chartData: dashboardAnalytics.chartData,
    selectionSummary: dashboardAnalytics.selectionSummary,
    slaAnalysis: dashboardAnalytics.slaAnalysis,
    backlogAnalysis: backlogAnalysis.backlogAnalysis,
    interfaceAnalysis: interfaceAnalysis.interfaceAnalysis
  });
  const { goals, updateGoals } = useGoals();
  const stcGtcAnalysis = useStcGtcAnalysis(data, dashboardAnalytics.chartData, dashboardAnalytics.visibleRange);
  const rmTypeComparison = useRmTypeComparison(data, dashboardAnalytics.chartData, dashboardAnalytics.visibleRange);
  const camAnalysis = useCamAnalysis(data, dashboardAnalytics.chartData, dashboardAnalytics.visibleRange);
  const trendForecast = useTrendForecast(dashboardAnalytics.chartData);
  const riskAlerts = useRiskAlerts({
    backlogAnalysis: backlogAnalysis.backlogAnalysis,
    interfaceAnalysis: interfaceAnalysis.interfaceAnalysis,
    slaAnalysis: dashboardAnalytics.slaAnalysis,
    selectionSummary: dashboardAnalytics.selectionSummary,
    stcGtcAnalysis,
    goals
  });

  const handleFileUpload = (e) => {
    ai.resetAiAnalysis();
    syncFileUpload(e);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 overflow-x-hidden">
      <div className="w-full px-4 py-4 md:px-10 md:py-8 transition-all">
        <header className="mb-8 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 group">
              <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg transition-transform group-hover:scale-110"><Activity className="text-white" size={24} /></div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Monitor Logístico: <span className="text-indigo-600">Dashboard de acompanhamento de RM</span></h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">WMS & Singra</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-3">
                <button onClick={() => performSync(true)} disabled={loading} className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 text-white shadow-sm flex items-center gap-2 hover:bg-indigo-700 transition-all text-sm disabled:opacity-50 active:scale-95">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />} Sincronizar Robôs
                </button>
                <label className="px-6 py-2.5 rounded-xl font-bold bg-white border border-slate-200 shadow-sm flex items-center gap-2 hover:border-indigo-500 hover:text-indigo-600 transition-all text-sm cursor-pointer active:scale-95">
                  <Upload size={18} /> {fileName || "Enviar Planilha"}
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              <div className="flex items-center gap-2">
                {data.length > 0 && <HealthBadge health={riskAlerts.health} />}
                {lastSync && (
                  <div className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5 bg-slate-200/50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                    <Clock size={12} className="text-indigo-500" /> Última atualização: <span className="text-slate-700">{lastSync}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center justify-between gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-medium">
              <span className="flex items-center gap-2"><AlertCircle size={18} className="shrink-0" /> {error}</span>
            </div>
          )}

          {data.length > 0 && (
            <div className="flex p-1 bg-white rounded-2xl border border-slate-200 w-fit shadow-sm overflow-x-auto max-w-full">
              <button onClick={() => setActiveTab('dashboard')} className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard size={16} /> Indicadores</button>
              <button onClick={() => setActiveTab('backlog')} className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'backlog' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Hourglass size={16} /> RM em processamento</button>
              <button onClick={() => setActiveTab('interface')} className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'interface' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Network size={16} /> Interface SINGRA x WMS</button>
              <button onClick={() => setActiveTab('email')} className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'email' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Search size={16} /> Busca por E-mail</button>
              <button onClick={() => setActiveTab('cam')} className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'cam' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Users size={16} /> Por CAM</button>
            </div>
          )}
        </header>

        {data.length > 0 ? (
          activeTab === 'dashboard' ? (
            <DashboardTab
              selectionSummary={dashboardAnalytics.selectionSummary}
              backlogAnalysis={backlogAnalysis.backlogAnalysis}
              slaAnalysis={dashboardAnalytics.slaAnalysis}
              chartData={dashboardAnalytics.chartData}
              visibleRangeData={dashboardAnalytics.visibleRangeData}
              dynamicAnalysis={dashboardAnalytics.dynamicAnalysis}
              aiAnalysis={ai.aiAnalysis}
              isAnalyzing={ai.isAnalyzing}
              aiError={ai.aiError}
              analyzeWithAI={ai.analyzeWithAI}
              visibleRange={dashboardAnalytics.visibleRange}
              setVisibleRange={dashboardAnalytics.setVisibleRange}
              selectedDateRange={dashboardAnalytics.selectedDateRange}
              activePresetKey={dashboardAnalytics.activePresetKey}
              applyPreset={dashboardAnalytics.applyPreset}
              applyCustomRange={dashboardAnalytics.applyCustomRange}
              comparisonMode={dashboardAnalytics.comparisonMode}
              setComparisonMode={dashboardAnalytics.setComparisonMode}
              selectedPiSegment={selectedPiSegment}
              setSelectedPiSegment={setSelectedPiSegment}
              data={data}
              handleDownloadExcel={downloadExcel}
              periodComparison={dashboardAnalytics.periodComparison}
              comparisonSeries={dashboardAnalytics.comparisonSeries}
              trendForecast={trendForecast}
              stcGtcAnalysis={stcGtcAnalysis}
              rmTypeComparison={rmTypeComparison}
              camAnalysis={camAnalysis.camAnalysis}
              interfaceAnalysis={interfaceAnalysis.interfaceAnalysis}
              interfaceStartDate={interfaceAnalysis.interfaceStartDate}
              setInterfaceStartDate={interfaceAnalysis.setInterfaceStartDate}
              interfaceEndDate={interfaceAnalysis.interfaceEndDate}
              setInterfaceEndDate={interfaceAnalysis.setInterfaceEndDate}
              health={riskAlerts.health}
              alerts={riskAlerts.alerts}
              onNavigate={setActiveTab}
              goals={goals}
              updateGoals={updateGoals}
              yoyAnalysis={yoyAnalysis.yoyAnalysis}
              selectedYoyYears={yoyAnalysis.selectedYoyYears}
              toggleYoyYear={yoyAnalysis.toggleYoyYear}
              yoyMetrics={yoyAnalysis.yoyMetrics}
              setYoyMetrics={yoyAnalysis.setYoyMetrics}
            />
          ) : activeTab === 'backlog' ? (
            <BacklogTab
              backlogAnalysis={backlogAnalysis.backlogAnalysis}
              backlogStartDate={backlogAnalysis.backlogStartDate}
              setBacklogStartDate={backlogAnalysis.setBacklogStartDate}
              backlogEndDate={backlogAnalysis.backlogEndDate}
              setBacklogEndDate={backlogAnalysis.setBacklogEndDate}
              backlogTypeFilter={backlogAnalysis.backlogTypeFilter}
              setBacklogTypeFilter={backlogAnalysis.setBacklogTypeFilter}
              selectedBucket={selectedBucket}
              setSelectedBucket={setSelectedBucket}
              bucketSearchTerm={bucketSearchTerm}
              setBucketSearchTerm={setBucketSearchTerm}
              handleDownloadExcel={downloadExcel}
            />
          ) : activeTab === 'interface' ? (
            <InterfaceTab
              interfaceAnalysis={interfaceAnalysis.interfaceAnalysis}
              selectedErrorFilter={interfaceAnalysis.selectedErrorFilter}
              setSelectedErrorFilter={interfaceAnalysis.setSelectedErrorFilter}
              handleDownloadExcel={downloadExcel}
            />
          ) : activeTab === 'email' ? (
            <EmailSearchTab
              emailText={emailExtractor.emailText}
              setEmailText={emailExtractor.setEmailText}
              extractedOrders={emailExtractor.extractedOrders}
              emailResultsSummary={emailExtractor.emailResultsSummary}
              savedSearches={emailExtractor.savedSearches}
              newSearchName={emailExtractor.newSearchName}
              setNewSearchName={emailExtractor.setNewSearchName}
              handleSaveSearch={emailExtractor.handleSaveSearch}
              handleDeleteSearch={emailExtractor.handleDeleteSearch}
              handleDownloadExcel={downloadExcel}
            />
          ) : activeTab === 'cam' ? (
            <CamAnalysisTab
              rows={camAnalysis.rows}
              summary={camAnalysis.summary}
              search={camAnalysis.search}
              setSearch={camAnalysis.setSearch}
              sortKey={camAnalysis.sortKey}
              sortDir={camAnalysis.sortDir}
              toggleSort={camAnalysis.toggleSort}
            />
          ) : null
        ) : (
          <div className="mt-32 text-center flex flex-col items-center animate-pulse">
             <div className={`w-40 h-40 bg-white rounded-3xl shadow-2xl flex items-center justify-center mb-8 border border-slate-100`}>
               {loading ? <Loader2 size={60} className="text-indigo-500 animate-spin" /> : <Database size={60} className="text-indigo-500 opacity-20" />}
             </div>
             <h2 className="text-2xl font-black text-slate-800 tracking-tight">Supply Monitor Integrado</h2>
             <p className="text-slate-400 text-sm mt-2 font-medium">Aguarde o carregamento ou clique em Sincronizar Robôs.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
