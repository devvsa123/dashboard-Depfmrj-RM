-- =====================================================================
-- Nome de exibição dos programadores
--
-- Rode DEPOIS de criar os três usuários em Authentication → Users.
-- Sem isto o sistema usa a parte do e-mail antes do @ como nome, e é
-- esse nome que vai impresso no documento como "Programador do DepFMRJ".
--
-- Troque os e-mails pelos que você cadastrou e clique em RUN.
-- =====================================================================

update auth.users set raw_user_meta_data =
  coalesce(raw_user_meta_data, '{}'::jsonb) || '{"nome":"SC Fernando"}'::jsonb
where email = 'fernando@exemplo.mil.br';

update auth.users set raw_user_meta_data =
  coalesce(raw_user_meta_data, '{}'::jsonb) || '{"nome":"SG Pinheiro"}'::jsonb
where email = 'pinheiro@exemplo.mil.br';

update auth.users set raw_user_meta_data =
  coalesce(raw_user_meta_data, '{}'::jsonb) || '{"nome":"SO Wagner"}'::jsonb
where email = 'wagner@exemplo.mil.br';

-- Conferência: deve listar os três com o nome preenchido.
select email, raw_user_meta_data ->> 'nome' as nome
from auth.users
order by email;
