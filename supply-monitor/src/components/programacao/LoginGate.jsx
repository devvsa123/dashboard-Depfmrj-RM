import { useState } from 'react';
import { Lock, LogIn, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';
import { supabaseConfigurado, AVISO_SEM_CONFIG } from '../../lib/supabase';

// Porta de entrada do módulo. A programação é trabalho interno dos
// programadores do DepFMRJ, então nada dela aparece para quem não entrou.
const LoginGate = ({ auth, children }) => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);

  if (!supabaseConfigurado) {
    return (
      <div className="max-w-xl mx-auto mt-16 bg-white rounded-3xl border border-amber-200 p-8 text-center">
        <ShieldAlert className="text-amber-500 mx-auto mb-4" size={40} />
        <h2 className="text-lg font-black text-slate-800">Banco não configurado</h2>
        <p className="text-sm text-slate-500 font-medium mt-2 leading-relaxed">{AVISO_SEM_CONFIG}</p>
      </div>
    );
  }

  if (auth.carregando) {
    return (
      <div className="flex flex-col items-center justify-center mt-24 text-slate-400">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
        <p className="text-sm font-bold mt-3">Verificando acesso...</p>
      </div>
    );
  }

  if (auth.autenticado) return children;

  const enviar = async (e) => {
    e.preventDefault();
    setEntrando(true);
    await auth.entrar(email, senha);
    setEntrando(false);
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <form onSubmit={enviar} className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 space-y-5">
        <div className="text-center">
          <div className="bg-indigo-50 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="text-indigo-600" size={24} />
          </div>
          <h2 className="text-lg font-black text-slate-800">Programação Semanal</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Acesso restrito aos programadores do DepFMRJ.</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">E-mail</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Senha</label>
            <input
              type="password" value={senha} onChange={e => setSenha(e.target.value)} required autoComplete="current-password"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {auth.erro && (
          <p className="flex items-center gap-2 text-red-600 text-xs font-bold p-3 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle size={14} className="shrink-0" /> {auth.erro}
          </p>
        )}

        <button
          type="submit" disabled={entrando || !email || !senha}
          className="w-full px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-40 transition-all active:scale-95"
        >
          {entrando ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {entrando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="text-[11px] text-slate-400 text-center font-medium">
          Esqueceu a senha ou precisa de acesso? Procure o administrador do sistema.
        </p>
      </form>
    </div>
  );
};

export default LoginGate;
