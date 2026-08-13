-- =====================================================================
--  SUIVI DES CONSOMMABLES : colles, joints, croisillons, plots
-- ---------------------------------------------------------------------
--  Problème résolu :
--  le logiciel décompte la marchandise dès la facturation, alors que le
--  client vient la chercher plus tard (parfois beaucoup plus tard).
--  Le stock informatique est donc plus bas que le stock réel du dépôt.
--  Ce module tient le registre de ce qui est vendu mais pas encore parti,
--  et des retours clients, pour retrouver le stock physique réel.
--
--  Stock physique réel = stock logiciel + en attente de retrait + retours
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. CATALOGUE DES CONSOMMABLES
-- ---------------------------------------------------------------------
create table if not exists consommables (
  id                  uuid primary key default gen_random_uuid(),
  categorie           text not null check (categorie in ('colle','joint','croisillon','plot','autre')),
  reference           text,
  designation         text not null,
  conditionnement     text,                       -- « sac 25 kg », « seau 5 kg », « sachet 500 pcs »
  unite               text not null default 'unité',  -- sac, seau, sachet, pièce…
  stock_logiciel      numeric not null default 0,     -- dernier stock relevé dans le logiciel
  stock_logiciel_maj  timestamptz,
  actif               boolean not null default true,
  created_at          timestamptz not null default now()
);

create index if not exists idx_consommables_categorie on consommables(categorie) where actif;


-- ---------------------------------------------------------------------
-- 2. ENLÈVEMENTS : ce qui est vendu et attend d'être retiré
-- ---------------------------------------------------------------------
create table if not exists enlevements (
  id                uuid primary key default gen_random_uuid(),
  consommable_id    uuid not null references consommables(id) on delete restrict,
  client_nom        text not null,
  client_tel        text,
  document_type     text not null default 'facture'
                    check (document_type in ('devis','commande','facture')),
  document_ref      text,                          -- n° de devis / commande / facture
  quantite_vendue   numeric not null check (quantite_vendue > 0),
  quantite_retiree  numeric not null default 0 check (quantite_retiree >= 0),
  date_vente        date not null default current_date,
  statut            text not null default 'en_attente'
                    check (statut in ('en_attente','partiel','solde','annule')),
  note              text,
  cree_par          uuid references auth.users(id),
  cree_par_nom      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint retrait_pas_superieur_au_vendu check (quantite_retiree <= quantite_vendue)
);

create index if not exists idx_enlevements_statut on enlevements(statut);
create index if not exists idx_enlevements_client on enlevements(lower(client_nom));
create index if not exists idx_enlevements_consommable on enlevements(consommable_id);


-- ---------------------------------------------------------------------
-- 3. JOURNAL DES MOUVEMENTS : retraits, retours, ajustements
-- ---------------------------------------------------------------------
create table if not exists mouvements_consommables (
  id              uuid primary key default gen_random_uuid(),
  enlevement_id   uuid references enlevements(id) on delete cascade,  -- null pour un retour libre
  consommable_id  uuid not null references consommables(id) on delete restrict,
  type            text not null check (type in ('retrait','retour','ajustement')),
  quantite        numeric not null check (quantite > 0),
  client_nom      text,
  note            text,
  par             uuid references auth.users(id),
  par_nom         text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_mouvements_date on mouvements_consommables(created_at desc);
create index if not exists idx_mouvements_consommable on mouvements_consommables(consommable_id);


-- ---------------------------------------------------------------------
-- 4. STATUT AUTOMATIQUE DES ENLÈVEMENTS
--    Le statut se recalcule seul à chaque modification de la quantité
--    retirée : plus d'incohérence possible entre les deux.
-- ---------------------------------------------------------------------
create or replace function maj_statut_enlevement()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();

  if new.statut = 'annule' then
    return new;                                   -- un enlèvement annulé le reste
  elsif new.quantite_retiree <= 0 then
    new.statut := 'en_attente';
  elsif new.quantite_retiree >= new.quantite_vendue then
    new.statut := 'solde';
  else
    new.statut := 'partiel';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_maj_statut_enlevement on enlevements;
create trigger trg_maj_statut_enlevement
  before insert or update on enlevements
  for each row execute function maj_statut_enlevement();


-- ---------------------------------------------------------------------
-- 5. VUE DE SYNTHÈSE : l'écart de stock par produit
-- ---------------------------------------------------------------------
create or replace view v_ecarts_stock as
select
  c.id,
  c.categorie,
  c.reference,
  c.designation,
  c.conditionnement,
  c.unite,
  c.stock_logiciel,
  c.stock_logiciel_maj,
  coalesce(e.reste_a_retirer, 0)                     as en_attente_retrait,
  coalesce(r.total_retours, 0)                       as retours_non_repris,
  c.stock_logiciel
    + coalesce(e.reste_a_retirer, 0)
    + coalesce(r.total_retours, 0)                   as stock_physique_estime,
  coalesce(e.nb_clients, 0)                          as nb_clients_concernes,
  e.plus_ancien
from consommables c
left join (
  select
    consommable_id,
    sum(quantite_vendue - quantite_retiree) as reste_a_retirer,
    count(distinct lower(client_nom))       as nb_clients,
    min(date_vente)                         as plus_ancien
  from enlevements
  where statut in ('en_attente','partiel')
  group by consommable_id
) e on e.consommable_id = c.id
left join (
  select consommable_id, sum(quantite) as total_retours
  from mouvements_consommables
  where type = 'retour'
  group by consommable_id
) r on r.consommable_id = c.id
where c.actif;


-- ---------------------------------------------------------------------
-- 6. SÉCURITÉ (RLS) : réservé aux collaborateurs connectés
-- ---------------------------------------------------------------------
alter table consommables            enable row level security;
alter table enlevements             enable row level security;
alter table mouvements_consommables enable row level security;

-- Le catalogue : lecture pour tous, écriture pour tous (le comptoir en a besoin)
drop policy if exists "Consommables : lecture" on consommables;
create policy "Consommables : lecture"
  on consommables for select to authenticated using (true);

drop policy if exists "Consommables : creation" on consommables;
create policy "Consommables : creation"
  on consommables for insert to authenticated with check (true);

drop policy if exists "Consommables : modification" on consommables;
create policy "Consommables : modification"
  on consommables for update to authenticated using (true) with check (true);

-- Suppression d'un produit : réservée aux responsables
drop policy if exists "Consommables : suppression responsables" on consommables;
create policy "Consommables : suppression responsables"
  on consommables for delete to authenticated
  using (
    exists (
      select 1 from employee_profiles p
      where p.id = auth.uid()
        and p.poste in ('Dirigeant de la société', 'Responsable magasin')
    )
  );

-- Les enlèvements : tout le monde travaille dessus au comptoir
drop policy if exists "Enlevements : lecture" on enlevements;
create policy "Enlevements : lecture"
  on enlevements for select to authenticated using (true);

drop policy if exists "Enlevements : creation" on enlevements;
create policy "Enlevements : creation"
  on enlevements for insert to authenticated with check (true);

drop policy if exists "Enlevements : modification" on enlevements;
create policy "Enlevements : modification"
  on enlevements for update to authenticated using (true) with check (true);

drop policy if exists "Enlevements : suppression responsables" on enlevements;
create policy "Enlevements : suppression responsables"
  on enlevements for delete to authenticated
  using (
    exists (
      select 1 from employee_profiles p
      where p.id = auth.uid()
        and p.poste in ('Dirigeant de la société', 'Responsable magasin')
    )
  );

-- Le journal : on écrit et on lit, on ne réécrit pas l'histoire
drop policy if exists "Mouvements : lecture" on mouvements_consommables;
create policy "Mouvements : lecture"
  on mouvements_consommables for select to authenticated using (true);

drop policy if exists "Mouvements : creation" on mouvements_consommables;
create policy "Mouvements : creation"
  on mouvements_consommables for insert to authenticated with check (true);

drop policy if exists "Mouvements : suppression responsables" on mouvements_consommables;
create policy "Mouvements : suppression responsables"
  on mouvements_consommables for delete to authenticated
  using (
    exists (
      select 1 from employee_profiles p
      where p.id = auth.uid()
        and p.poste in ('Dirigeant de la société', 'Responsable magasin')
    )
  );


-- ---------------------------------------------------------------------
-- 7. QUELQUES PRODUITS POUR DÉMARRER
--    À adapter à vos références réelles depuis l'onglet « Produits ».
-- ---------------------------------------------------------------------
insert into consommables (categorie, designation, conditionnement, unite) values
  ('colle',      'Colle carrelage grise',            'sac 25 kg',       'sac'),
  ('colle',      'Colle carrelage blanche',          'sac 25 kg',       'sac'),
  ('colle',      'Colle souple grands formats',      'sac 25 kg',       'sac'),
  ('joint',      'Joint gris',                       'sac 5 kg',        'sac'),
  ('joint',      'Joint blanc',                      'sac 5 kg',        'sac'),
  ('joint',      'Joint anthracite',                 'sac 5 kg',        'sac'),
  ('croisillon', 'Croisillons 2 mm',                 'sachet 500 pcs',  'sachet'),
  ('croisillon', 'Croisillons 3 mm',                 'sachet 500 pcs',  'sachet'),
  ('croisillon', 'Croisillons 5 mm',                 'sachet 250 pcs',  'sachet'),
  ('plot',       'Plot réglable 20-30 mm',           'pièce',           'pièce'),
  ('plot',       'Plot réglable 30-50 mm',           'pièce',           'pièce'),
  ('plot',       'Plot réglable 50-80 mm',           'pièce',           'pièce')
on conflict do nothing;
