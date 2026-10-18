import { useState } from 'react';
import { CalendarRange, Ban, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import SectionLabel from '../SectionLabel';
import CapacidadePanel from './CapacidadePanel';
import DemandasPanel from './DemandasPanel';
import GradeSemanal from './GradeSemanal';
import DocumentoCard from './DocumentoCard';
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
const ProgramacaoTab = (p) => (
  <div className="space-y-6 animate-in fade-in zoom-in duration-300">
    <SectionLabel title="Programação Semanal" description="Proposta de grade de atendimento — o programador valida, ajusta e publica" />

    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <CalendarRange className="text-indigo-500" size={20} />
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Semana Programada</p>
          <p className="text-lg font-black text-slate-800 leading-tight">{rotuloSemana(p.semanaRef)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => p.setSemanaRef(segundaDaSemana(somaDias(p.semanaRef, -7)))} className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100"><ChevronLeft size={18} /></button>
        <button onClick={() => p.setSemanaRef(segundaDaSemana(somaDias(p.semanaRef, 7)))} className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100"><ChevronRight size={18} /></button>
      </div>
    </div>

    {p.resultado && <GradeSemanal resultado={p.resultado} />}

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
        setProgramador={p.setProgramador}
        encarregado={p.encarregado}
        setEncarregado={p.setEncarregado}
      />
    </div>

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
        <BloqueiosPanel bloqueios={p.bloqueios} adicionarBloqueio={p.adicionarBloqueio} removerBloqueio={p.removerBloqueio} />
      </div>
    </div>
  </div>
);

export default ProgramacaoTab;
