-- =====================================================================
-- Carga inicial do cadastro de CAM e rotas
--
-- Monta o cadastro a partir de três fontes: a planilha de CAM (coluna
-- "Modal Logístico Sugerido" — "Entrega OM" vira GTC, "Transportadora"
-- vira STC), o quadro da Seção de Estocagem (dias de rota e janelas do
-- CDAM) e as definições do programador.
--
-- É seguro rodar mais de uma vez: usa ON CONFLICT DO NOTHING, então
-- nunca sobrescreve um CAM que já foi ajustado na tela de configuração.
-- Para refazer um CAM específico, apague a linha dele antes.
--
-- dias_rota: 1=segunda, 2=terça, 3=quarta, 4=quinta, 5=sexta
-- =====================================================================

insert into public.cam_config
  (cam, sigla, tratamento, documento_esperado, dias_rota, janela_inicio, janela_fim, observacao)
values
-- ── GTC: nós entregamos (planilha: "Entrega OM") ────────────────────
  ('CDU - COM1ºDN',                 'Com1ºDN',          'GTC', 'GTC', '{3}',  null, null, ''),
  ('PEU - Escola Naval',            'Escola Naval',     'GTC', 'GTC', '{3}',  null, null, ''),
  ('PEU - CIAW',                    'CIAW',             'GTC', 'GTC', '{5}',  null, null, ''),
  ('CDU BAMRJ',                     'BAMRJ',            'GTC', 'GTC', '{5}',  null, null, 'Ramal 7119 no quadro — confirmar se é este ou o da Incorporação'),
  ('PDU INCORPORAÇÃO',              'CDU Incorporação', 'GTC', 'GTC', '{4}',  null, null, 'Ramal 7118 no quadro — confirmar se é este ou o CDU-BAMRJ'),
  ('PDU - BNRJ',                    'BNRJ',             'GTC', 'GTC', '{1}',  null, null, 'Quadro admite segunda ou quinta'),
  ('PEU - BFNIF (Ilha das Flores)', 'BFNIF',            'GTC', 'GTC', '{4}',  null, null, 'Quadro admite segunda ou quinta'),
  ('PEU - CIAMPA',                  'CIAMPA',           'GTC', 'GTC', '{2}',  null, null, ''),
  ('PEU- CADIM (Marambaia)',        'CADIM',            'GTC', 'GTC', '{2}',  null, null, 'Não consta na planilha de CAM; rota veio do quadro'),
  ('PEU - BFNRM',                   'BFNRM',            'GTC', 'GTC', '{2}',  null, null, ''),
  ('PEU - BFNIG',                   'BFNIG',            'GTC', 'GTC', '{2}',  null, null, ''),
  ('PDU - MÓVEL',                   'PDU Móvel',        'GTC', 'GTC', '{2}',  null, null, 'Móvel dos CDU — dia próprio, a confirmar'),
  ('PDU MÓVEL - CDU1DN',            'PDU Móvel CDU1DN', 'GTC', 'GTC', '{3}',  null, null, 'Móvel do CDU-1DN — segue o dia do CDU-1DN, a confirmar'),
  ('PEU - Escola Naval(Aspirantes)','Escola Naval',     'GTC', 'GTC', '{3}',  null, null, 'Grafia duplicada de PEU - Escola Naval'),

-- ── STC: terceiro retira (planilha: "Transportadora / Modal Terrestre") ──
  ('PDU - CeIMMa',                  'CeIMMa',           'STC', 'STC', '{}',   25, 30, ''),
  ('PDU - CeIMBe',                  'CeIMBe',           'STC', 'STC', '{}',   25, 30, ''),
  ('PDU - CeIMLa',                  'CeIMLa',           'STC', 'STC', '{}',    1,  6, ''),
  ('PDU - Com7ºDN',                 'Com7ºDN',          'STC', 'STC', '{}',    1,  6, ''),
  ('PDU - CeIMNa',                  'CeIMNa',           'STC', 'STC', '{}',    7, 12, ''),
  ('PDU - CeIMSa - ARATU',          'CeIMSa',           'STC', 'STC', '{}',    7, 12, ''),
  ('PDU-DEPNAVSA GPTFNSA',          'GptFNSa',          'STC', 'STC', '{}',    7, 12, ''),
  ('PEU - Colégio Naval',           'Colégio Naval',    'STC', 'STC', '{}',   13, 18, ''),
  ('PDU - CeIMRG',                  'CeIMRG',           'STC', 'STC', '{}',   13, 18, ''),
  ('PDU-EAMSC',                     'EAMSC',            'STC', 'STC', '{}',   13, 18, ''),
  ('PEU - CPAL (Maceió)',           'CPAL',             'STC', 'STC', '{}',   19, 24, 'Consta no quadro, não na planilha de CAM'),
  ('PEU - EAMES',                   'EAMES',            'STC', 'STC', '{}',   19, 24, ''),
  ('PEU - EAMPE',                   'EAMPE',            'STC', 'STC', '{}',   19, 24, ''),
  ('PEU - EAMCE',                   'EAMCE',            'STC', 'STC', '{}',   19, 24, ''),
  ('PDU - CeIMSPA',                 'CeIMSPA',          'STC', 'STC', '{}',   19, 24, ''),
  ('PEU-CIABA',                     'CIABA',            'STC', 'STC', '{}',   null, null, 'Consta na planilha de CAM, não no quadro — janela a definir'),
  ('CeIMMa - Manaus',               'CeIMMa',           'STC', 'STC', '{}',   25, 30, 'Grafia duplicada de PDU - CeIMMa'),
  ('CeIMBe - Belém',                'CeIMBe',           'STC', 'STC', '{}',   25, 30, 'Grafia duplicada de PDU - CeIMBe'),
  ('CeIMLa - Ladário',              'CeIMLa',           'STC', 'STC', '{}',    1,  6, 'Grafia duplicada de PDU - CeIMLa'),
  ('CeIMRG - Rio Grande',           'CeIMRG',           'STC', 'STC', '{}',   13, 18, 'Grafia duplicada de PDU - CeIMRG'),
  ('CeIMSPA - São P. Aldeia',       'CeIMSPA',          'STC', 'STC', '{}',   19, 24, 'Grafia duplicada de PDU - CeIMSPA'),

-- ── Caso especial: quem retira é terceiro, mas o documento é GTC ─────
  ('NÚCLEO DE IMPLANTAÇÃO DO CENTR','Núcleo Implantação','STC','GTC', '{}',   null, null, 'Entrega a empresas: terceiro retira, mas o documento lançado é GTC'),

-- ── Ocultos: existem na base e não são mais usados ───────────────────
  ('GERÊNCIA CCIM',                 'CCIM',             'OCULTO', null, '{}', null, null, ''),
  ('CENTRO DE CONTROLE DE INVENTAR','CCIM',             'OCULTO', null, '{}', null, null, ''),
  ('PEU - DABM',                    'DABM',             'OCULTO', null, '{}', null, null, '')
on conflict (cam) do nothing;

-- Conferência: quantos ficaram em cada tratamento.
select tratamento, count(*) as cams
from public.cam_config
group by tratamento
order by tratamento;
