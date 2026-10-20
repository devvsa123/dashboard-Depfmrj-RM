import { useState } from 'react';
import { CalendarRange, Ban, Plus, Trash2, ChevronLeft, ChevronRight, AlertCircle, Loader2, Cloud, CloudOff, UserCircle2, LogOut } from 'lucide-react';
import SectionLabel from '../SectionLabel';
import CapacidadePanel from './CapacidadePanel';
import DemandasPanel from './DemandasPanel';
import GradeSemanal from './GradeSemanal';
import DocumentoCard from './DocumentoCard';
import AcompanhamentoPanel from './AcompanhamentoPanel';
import ConfigCamPanel from './ConfigCamPanel';
import ForcarCamPanel from './ForcarCamPanel';
import ExpedicaoPanel from './ExpedicaoPanel';
import VersoesPanel from './VersoesPanel';
import { rotuloSemana, somaDias, segundaDaSemana, formatarBr } from '../../utils/programacao/semana';

const BloqueiosPanel = ({ bloqueios, adicionarBloqueio, removerBloqueio }) => {
  const [data, setData] = useState('');
  const [motivo, setMotivo] = useState('');
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center gap-2">
        <Ban className="text-red-500" size={20} />
        <h3 className="text-lg font-black text-slate-800">Dias sem Separação</h3>
      </div>
      <div className="p-6 flex flex-col sm:flex-row gap-3 border-b border-slate-100 bg-slate-50/50">
        <input type="date" value={data} onChange={e => setData(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-500" />
        <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo (feriado, licença, inventário...)" className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-500" />
        <button
          onClick={() => { adicionarBloqueio(data, motivo); setData(''); setMotivo(''); }}
          disabled={!data || !motivo.trim()}
          className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-sm flex items-center gap-1.5 hover:bg-slate-900 disabled:opacity-40 transition-all active:scale-95"
        >
          <Plus size={16} /> Bloquear
        </button>
      </div>
      <div className="divide-y divide-slate-50">
        {bloqueios.length === 0 && <p className="px-6 py-6 text-center text-sm text-slate-400 italic">Nenhum dia bloqueado.</p>}
        {bloqueios.map(b => (
          <div key={b.data} className="px-6 py-3 flex items-center justify-between">
            <span className="text-sm"><strong className="text-slate-800">{formatarBr(b.data)}</strong> <span className="text-slate-500">— {b.motivo}</span></span>
            <button onClick={() => removerBloqueio(b.data)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Módulo de programação semanal. O programador valida uma proposta: o
// sistema monta, explica cada alocação e aponta os conflitos; a decisão
// continua sendo dele.
const SUBABAS = [
  { key: 'montagem', label: 'Montar a semana' },
  { key: 'andamento', label: 'Andamento' },
  { key: 'expedicao', label: 'Expedição' },
  { key: 'config', label: 'CAM e Rotas' }
];

// Abas que não falam de uma semana específica: olham o estado de agora.
const SEM_SEMANA = new Set(['config', 'expedicao']);

const ProgramacaoTab = (p) => {
  const [subaba, setSubaba] = useState('montagem');
  return (
  <div className="space-y-6 animate-in fade-in zoom-in duration-300">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      {SEM_SEMANA.has(subaba)
        ? <span />
        : <SectionLabel title="Programação Semanal" description="Proposta de grade de atendimento — o programador valida, ajusta e publica" />}
      {p.auth?.autenticado && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <UserCircle2 size={14} className="text-indigo-500" /> {p.programador || p.auth.usuario?.email}
          </span>
          <button onClick={p.auth.sair} className="text-[11px] font-bold text-slate-400 hover:text-red-500 px-2 py-1.5 flex items-center gap-1">
            <LogOut size={13} /> Sair
          </button>
        </div>
      )}
    </div>

    {p.erroSync && (
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium">
        <AlertCircle size={18} className="shrink-0 mt-0.5" /> {p.erroSync}
      </div>
    )}

    {p.carregando && (
      <div className="flex items-center gap-2 text-slate-400 text-sm font-bold">
        <Loader2 size={16} className="animate-spin text-indigo-500" /> Carregando a programação...
      </div>
    )}

    <div className="flex p-1 bg-white rounded-2xl border border-slate-200 w-fit shadow-sm">
      {SUBABAS.map(s => (
        <button
          key={s.key}
          onClick={() => setSubaba(s.key)}
          className={`px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${subaba === s.key ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          {s.label}
        </button>
      ))}
    </div>

    {!SEM_SEMANA.has(subaba) && (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <CalendarRange className="text-indigo-500" size={20} />
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Semana Programada</p>
          <p className="text-lg font-black text-slate-800 leading-tight">{rotuloSemana(p.semanaRef)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-bold flex items-center gap-1.5 mr-2 ${p.salvando ? 'text-indigo-500' : 'text-slate-300'}`}>
          {p.salvando ? <><Cloud size={14} className="animate-pulse" /> salvando</> : <><CloudOff size={14} /> salvo</>}
        </span>
        <button onClick={() => p.setSemanaRef(segundaDaSemana(somaDias(p.semanaRef, -7)))} className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100"><ChevronLeft size={18} /></button>
        <button onClick={() => p.setSemanaRef(segundaDaSemana(somaDias(p.semanaRef, 7)))} className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100"><ChevronRight size={18} /></button>
      </div>
    </div>
    )}

    {subaba === 'expedicao' ? (
      <ExpedicaoPanel
        indiceWms={p.indiceWms}
        porCam={p.camConfig.porCam}
        semanaRef={p.semanaRef}
        programador={p.programador}
        encarregado={p.encarregado}
        setEncarregado={p.setEncarregado}
        ultimaVersao={p.ultimaVersao}
        forcados={p.forcados}
      />
    ) : subaba === 'config' ? (
      <ConfigCamPanel
        linhas={p.camConfig.linhas}
        resumo={p.camConfig.resumo}
        salvar={p.camConfig.salvar}
        carregando={p.camConfig.carregando}
        salvando={p.camConfig.salvando}
        erro={p.camConfig.erro}
      />
    ) : subaba === 'andamento' ? (
      <AcompanhamentoPanel
        versoes={p.versoes}
        semanaRef={p.semanaRef}
        indiceWms={p.indiceWms}
        diffPendente={p.diffPendente}
        publicar={p.publicar}
        handleDownloadExcel={p.handleDownloadExcel}
      />
    ) : (
    <>
    {p.resultado && <GradeSemanal resultado={p.resultado} />}

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <DemandasPanel demandas={p.demandas} adicionarDemanda={p.adicionarDemanda} removerDemanda={p.removerDemanda} />
      <div className="space-y-6">
        <CapacidadePanel
          capacidade={p.capacidadeMedida}
          janelaDias={p.janelaDias}
          setJanelaDias={p.setJanelaDias}
          janelas={p.janelas}
          grade={p.resultado?.grade || []}
          overrides={p.overrides}
          definirOverride={p.definirOverride}
        />
        <ForcarCamPanel
          fila={p.fila}
          porCam={p.camConfig.porCam}
          capacidadeMedida={p.capacidadeMedida}
          semanaRef={p.semanaRef}
          forcados={p.forcados}
          forcarCam={p.forcarCam}
          desforcarCam={p.desforcarCam}
          simularForcar={p.simularForcar}
        />
        <BloqueiosPanel bloqueios={p.bloqueios} adicionarBloqueio={p.adicionarBloqueio} removerBloqueio={p.removerBloqueio} />
      </div>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <VersoesPanel
        versoes={p.versoes}
        ultimaVersao={p.ultimaVersao}
        diffPendente={p.diffPendente}
        publicar={p.publicar}
        removerUltimaVersao={p.removerUltimaVersao}
        programador={p.programador}
        resultado={p.resultado}
      />
      <DocumentoCard
        versoes={p.versoes}
        ultimaVersao={p.ultimaVersao}
        diffPendente={p.diffPendente}
        semanaRef={p.semanaRef}
        programador={p.programador}
        encarregado={p.encarregado}
        setEncarregado={p.setEncarregado}
      />
    </div>
    </>
    )}
  </div>
  );
};

export default ProgramacaoTab;
