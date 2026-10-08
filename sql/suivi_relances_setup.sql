-- ============================================================================
--  SUIVI CLIENT  -  LOT 2 : relances
-- ----------------------------------------------------------------------------
--  Le lot 1 sait ou en est un projet. Il ne sait pas quand rappeler le client.
--  Ces deux ajouts s'en chargent : une date de prochaine relance sur le projet,
--  et l'historique de ce qui a ete fait a chaque fois.
--
--  Rythme decide par le magasin le 2026-10-08 : J+7, J+15, J+30 apres la date
--  du devis. Il est ecrit dans suivi-commun.js, pas ici : le changer ne doit
--  pas demander de toucher a la base.
--
--  A executer dans Supabase > SQL Editor. Relancable sans risque.
-- ============================================================================

-- ---------------------------------------------------------------
--  1. Le projet porte sa prochaine echeance
--     Une date posee sur le projet plutot que calculee a la volee : la liste
--     du jour devient une seule requete, et un vendeur peut repousser une
--     relance sans que le calcul la ramene le lendemain.
-- ---------------------------------------------------------------
alter table suivi_projets
  add column if not exists prochaine_relance date,
  add column if not exists relance_arretee   boolean not null default false;

comment on column suivi_projets.prochaine_relance is
  'Date a laquelle ce projet doit etre rappele. NULL = rien a faire.';
comment on column suivi_projets.relance_arretee is
  'Le vendeur a decide de ne plus relancer ce projet, sans le declarer perdu.';

create index if not exists suivi_projets_relance
  on suivi_projets (prochaine_relance) where prochaine_relance is not null;

-- ---------------------------------------------------------------
--  2. Ce qui a ete fait, a chaque relance
--     L'historique general garde la trace lisible ; cette table garde la
--     donnee exploitable : combien de relances, par quel canal, avec quel
--     resultat. C'est ce qui permettra plus tard de savoir ce qui marche.
-- ---------------------------------------------------------------
create table if not exists suivi_relances (
  id          uuid primary key default gen_random_uuid(),
  projet_id   uuid not null references suivi_projets(id) on delete cascade,
  prevue_le   date,
  faite_le    timestamptz not null default now(),
  canal       text check (canal in ('telephone', 'mail', 'passage')),
  resultat    text not null
              check (resultat in ('sans_reponse', 'rappeler', 'interesse',
                                  'reflechit', 'refus', 'signe')),
  note        text,
  vendeur_id  uuid references auth.users(id),
  cree_le     timestamptz not null default now()
);

create index if not exists suivi_relances_projet on suivi_relances (projet_id, faite_le desc);

-- ---------------------------------------------------------------
--  3. Acces : comme le reste du suivi
--     Tout le monde lit et ecrit, seuls les responsables suppriment.
-- ---------------------------------------------------------------
alter table suivi_relances enable row level security;

drop policy if exists "Equipe lit suivi_relances"            on suivi_relances;
drop policy if exists "Equipe ecrit suivi_relances"          on suivi_relances;
drop policy if exists "Equipe modifie suivi_relances"        on suivi_relances;
drop policy if exists "Responsables suppriment suivi_relances" on suivi_relances;

create policy "Equipe lit suivi_relances" on suivi_relances
  for select to authenticated using (true);
create policy "Equipe ecrit suivi_relances" on suivi_relances
  for insert to authenticated with check (true);
create policy "Equipe modifie suivi_relances" on suivi_relances
  for update to authenticated using (true) with check (true);
create policy "Responsables suppriment suivi_relances" on suivi_relances
  for delete to authenticated using (est_responsable());

-- ---------------------------------------------------------------
--  4. Les devis deja deposes entrent dans le circuit
--     Sans ca, seuls les devis deposes apres aujourd'hui seraient relances, et
--     l'ecran s'ouvrirait vide alors que des devis attendent.
--     Sept jours apres la date du devis, et jamais dans le passe : un devis du
--     mois dernier se rappelle demain, pas retroactivement trois fois.
-- ---------------------------------------------------------------
update suivi_projets p
   set prochaine_relance = greatest(
         (select min(d.date_doc) from suivi_documents d
           where d.projet_id = p.id and d.type_doc = 'devis') + 7,
         current_date)
 where p.etape in ('devis_envoye', 'en_relance')
   and p.prochaine_relance is null
   and p.relance_arretee is not true
   and exists (select 1 from suivi_documents d
                where d.projet_id = p.id and d.type_doc = 'devis');

-- ---------------------------------------------------------------
--  Verification
-- ---------------------------------------------------------------
select c.nom, p.titre, p.etape, p.prochaine_relance,
       (select count(*) from suivi_relances r where r.projet_id = p.id) as relances_faites
  from suivi_projets p
  join suivi_clients c on c.id = p.client_id
 order by p.prochaine_relance nulls last;
