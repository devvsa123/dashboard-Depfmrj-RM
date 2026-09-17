// Cabeçalho discreto para separar visualmente os grupos de informação do
// dashboard (ex: "Visão Geral", "Tendências"), dando hierarquia à página
// sem competir com os títulos dos cartões abaixo dele.
const SectionLabel = ({ title, description }) => (
  <div className="flex items-baseline gap-3 pt-2">
    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">{title}</h2>
    <div className="h-px flex-1 bg-slate-200" />
    {description && <p className="text-xs text-slate-400 font-medium whitespace-nowrap hidden md:block">{description}</p>}
  </div>
);

export default SectionLabel;
