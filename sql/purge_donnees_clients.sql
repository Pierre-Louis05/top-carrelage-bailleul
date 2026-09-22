-- ============================================================================
-- Suppression automatique des donnees clients de plus de trois ans
-- ----------------------------------------------------------------------------
-- Les mentions legales annoncent une conservation de trois ans. Ce script
-- programme une tache quotidienne (3 h du matin) qui efface les demandes plus
-- anciennes dans les deux tables qui contiennent des coordonnees de clients.
--
-- La date prise en compte est celle de la demande (created_at) : c'est la
-- lecture la plus prudente de "trois ans apres le dernier echange".
--
-- A executer une seule fois dans Supabase > SQL Editor. Relancer le script
-- ne cree pas de doublon : l'ancienne tache est remplacee.
-- ============================================================================

create extension if not exists pg_cron;

-- Remplacer la tache si elle existe deja
do $$
begin
  perform cron.unschedule('purge-donnees-clients');
exception when others then
  null;  -- la tache n'existait pas encore
end $$;

select cron.schedule(
  'purge-donnees-clients',
  '0 3 * * *',
  $$
    delete from public.contact_requests where created_at < now() - interval '3 years';
    delete from public.rdv_requests     where created_at < now() - interval '3 years';
  $$
);

-- Verification : la tache doit apparaitre ici
select jobname, schedule, active from cron.job where jobname = 'purge-donnees-clients';
