-- ============================================================================
--  SUIVI CLIENT  -  LOT 3 : les choses a faire
-- ----------------------------------------------------------------------------
--  Ce que le carnet papier faisait, en mieux : au telephone on promet
--  d'envoyer un devis, de se renseigner, de faire rappeler par un collegue.
--  Ces promesses n'ont aujourd'hui aucune trace dans l'outil, et elles
--  s'oublient.
--
--  Une seule table, volontairement simple. Une tache peut viser un client, un
--  projet, ou rien du tout : « commander les echantillons » est une tache
--  valable sans dossier.
--
--  A executer dans Supabase > SQL Editor. Relancable sans risque.
-- ============================================================================

create table if not exists suivi_taches (
  id         uuid primary key default gen_random_uuid(),
  texte      text not null,
  echeance   date,                       -- NULL = des que possible
  pour_qui   uuid references auth.users(id),
  client_id  uuid references suivi_clients(id) on delete set null,
  projet_id  uuid references suivi_projets(id) on delete set null,
  fait_le    timestamptz,
  fait_par   uuid references auth.users(id),
  cree_par   uuid references auth.users(id),
  cree_le    timestamptz not null default now()
);

-- L'index ne couvre que ce qui reste a faire : c'est la seule liste qu'on
-- affiche, et elle doit rester rapide meme quand l'historique grossit.
create index if not exists suivi_taches_a_faire
  on suivi_taches (pour_qui, echeance) where fait_le is null;
create index if not exists suivi_taches_client on suivi_taches (client_id);

-- ---------------------------------------------------------------
--  Acces : comme le reste du suivi.
--  Tout le monde voit tout, pour qu'une tache confiee a un collegue absent
--  puisse etre reprise. Seuls les responsables suppriment.
-- ---------------------------------------------------------------
alter table suivi_taches enable row level security;

drop policy if exists "Equipe lit suivi_taches"              on suivi_taches;
drop policy if exists "Equipe ecrit suivi_taches"            on suivi_taches;
drop policy if exists "Equipe modifie suivi_taches"          on suivi_taches;
drop policy if exists "Responsables suppriment suivi_taches" on suivi_taches;

create policy "Equipe lit suivi_taches" on suivi_taches
  for select to authenticated using (true);
create policy "Equipe ecrit suivi_taches" on suivi_taches
  for insert to authenticated with check (true);
create policy "Equipe modifie suivi_taches" on suivi_taches
  for update to authenticated using (true) with check (true);
create policy "Responsables suppriment suivi_taches" on suivi_taches
  for delete to authenticated using (est_responsable());

-- ---------------------------------------------------------------
--  Verification
-- ---------------------------------------------------------------
select count(*) as taches_existantes from suivi_taches;
