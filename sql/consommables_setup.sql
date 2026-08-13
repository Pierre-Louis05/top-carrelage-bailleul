-- =====================================================================
--  GESTION DE STOCK DES CONSOMMABLES
--  colles · joints · croisillons · plots
-- ---------------------------------------------------------------------
--  Objectif : savoir en permanence ce qu'il y a réellement au dépôt,
--  ce qui manque, quand recommander et quelle quantité commander,
--  avec un stock minimum de sécurité par référence.
--
--  Principe :
--    stock réel    = ce qui est physiquement au dépôt
--    réservé       = vendu mais pas encore emporté par le client
--    disponible    = stock réel - réservé   (ce qu'on peut encore vendre)
--    alerte        = disponible <= stock minimum  ->  à commander
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. CATALOGUE ET NIVEAUX DE STOCK
-- ---------------------------------------------------------------------
create table if not exists consommables (
  id               uuid primary key default gen_random_uuid(),
  categorie        text not null check (categorie in ('colle','joint','croisillon','plot','autre')),
  reference        text,
  designation      text not null,
  conditionnement  text,                       -- « sac 25 kg », « seau 5 kg », « sachet 500 pcs »
  unite            text not null default 'unité',   -- sac, seau, sachet, pièce…

  stock_reel       numeric not null default 0,     -- tenu à jour par les mouvements
  stock_mini       numeric not null default 0,     -- seuil de sécurité : en dessous, on recommande
  qte_reappro      numeric,                        -- quantité habituelle de commande (ex : 48 = 1 palette)
  fournisseur      text,                           -- chez qui on la commande

  actif            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_consommables_categorie on consommables(categorie) where actif;


-- ---------------------------------------------------------------------
-- 2. MOUVEMENTS DE STOCK
--    quantite est SIGNÉE : positive si ça entre, négative si ça sort.
--    C'est ce qui garantit que le stock ne peut jamais diverger.
-- ---------------------------------------------------------------------
create table if not exists mouvements_consommables (
  id              uuid primary key default gen_random_uuid(),
  consommable_id  uuid not null references consommables(id) on delete cascade,
  type            text not null check (type in ('entree','sortie','retour','inventaire')),
  quantite        numeric not null check (quantite <> 0),   -- signée
  stock_apres     numeric,                                  -- photo du stock après le mouvement
  client_nom      text,
  document_ref    text,
  note            text,
  par             uuid references auth.users(id),
  par_nom         text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_mouvements_date        on mouvements_consommables(created_at desc);
create index if not exists idx_mouvements_consommable on mouvements_consommables(consommable_id);


-- ---------------------------------------------------------------------
-- 3. RÉSERVATIONS : vendu, pas encore emporté
--    Le client repasse quand il veut : tant qu'il n'est pas venu,
--    la marchandise est encore au dépôt mais n'est plus disponible.
-- ---------------------------------------------------------------------
create table if not exists reservations_consommables (
  id                uuid primary key default gen_random_uuid(),
  consommable_id    uuid not null references consommables(id) on delete restrict,
  client_nom        text not null,
  client_tel        text,
  document_type     text not null default 'facture'
                    check (document_type in ('devis','commande','facture')),
  document_ref      text,
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

create index if not exists idx_reservations_statut      on reservations_consommables(statut);
create index if not exists idx_reservations_consommable on reservations_consommables(consommable_id);


-- ---------------------------------------------------------------------
-- 4. LE STOCK SE MET À JOUR TOUT SEUL
--    Chaque mouvement applique sa quantité au stock et garde une photo
--    du niveau atteint : l'historique reste lisible même des mois après.
-- ---------------------------------------------------------------------
create or replace function appliquer_mouvement_stock()
returns trigger
language plpgsql
as $$
declare
  nouveau numeric;
begin
  update consommables
     set stock_reel = stock_reel + new.quantite,
         updated_at = now()
   where id = new.consommable_id
  returning stock_reel into nouveau;

  new.stock_apres := nouveau;
  return new;
end;
$$;

drop trigger if exists trg_appliquer_mouvement on mouvements_consommables;
create trigger trg_appliquer_mouvement
  before insert on mouvements_consommables
  for each row execute function appliquer_mouvement_stock();


-- Statut d'une réservation recalculé automatiquement
create or replace function maj_statut_reservation()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.statut = 'annule' then
    return new;
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

drop trigger if exists trg_maj_statut_reservation on reservations_consommables;
create trigger trg_maj_statut_reservation
  before insert or update on reservations_consommables
  for each row execute function maj_statut_reservation();


-- ---------------------------------------------------------------------
-- 5. VUE DE PILOTAGE : l'état du stock en un coup d'œil
-- ---------------------------------------------------------------------
create or replace view v_etat_stock as
select
  c.id,
  c.categorie,
  c.reference,
  c.designation,
  c.conditionnement,
  c.unite,
  c.fournisseur,
  c.stock_reel,
  c.stock_mini,
  c.qte_reappro,
  coalesce(r.reserve, 0)                            as reserve,
  c.stock_reel - coalesce(r.reserve, 0)             as disponible,
  case
    when c.stock_reel - coalesce(r.reserve, 0) <= 0            then 'rupture'
    when c.stock_reel - coalesce(r.reserve, 0) <= c.stock_mini then 'a_commander'
    else 'ok'
  end                                                as etat,
  greatest(c.stock_mini - (c.stock_reel - coalesce(r.reserve, 0)), 0) as manque
from consommables c
left join (
  select consommable_id, sum(quantite_vendue - quantite_retiree) as reserve
  from reservations_consommables
  where statut in ('en_attente','partiel')
  group by consommable_id
) r on r.consommable_id = c.id
where c.actif;


-- ---------------------------------------------------------------------
-- 6. SÉCURITÉ (RLS) : réservé aux collaborateurs connectés
-- ---------------------------------------------------------------------
alter table consommables               enable row level security;
alter table mouvements_consommables    enable row level security;
alter table reservations_consommables  enable row level security;

drop policy if exists "Consommables lecture"      on consommables;
drop policy if exists "Consommables creation"     on consommables;
drop policy if exists "Consommables modification" on consommables;
drop policy if exists "Consommables suppression"  on consommables;

create policy "Consommables lecture"
  on consommables for select to authenticated using (true);
create policy "Consommables creation"
  on consommables for insert to authenticated with check (true);
create policy "Consommables modification"
  on consommables for update to authenticated using (true) with check (true);
create policy "Consommables suppression"
  on consommables for delete to authenticated
  using (exists (select 1 from employee_profiles p
                 where p.id = auth.uid()
                   and p.poste in ('Dirigeant de la société','Responsable magasin')));

drop policy if exists "Mouvements lecture"     on mouvements_consommables;
drop policy if exists "Mouvements creation"    on mouvements_consommables;
drop policy if exists "Mouvements suppression" on mouvements_consommables;

create policy "Mouvements lecture"
  on mouvements_consommables for select to authenticated using (true);
create policy "Mouvements creation"
  on mouvements_consommables for insert to authenticated with check (true);
create policy "Mouvements suppression"
  on mouvements_consommables for delete to authenticated
  using (exists (select 1 from employee_profiles p
                 where p.id = auth.uid()
                   and p.poste in ('Dirigeant de la société','Responsable magasin')));

drop policy if exists "Reservations lecture"      on reservations_consommables;
drop policy if exists "Reservations creation"     on reservations_consommables;
drop policy if exists "Reservations modification" on reservations_consommables;
drop policy if exists "Reservations suppression"  on reservations_consommables;

create policy "Reservations lecture"
  on reservations_consommables for select to authenticated using (true);
create policy "Reservations creation"
  on reservations_consommables for insert to authenticated with check (true);
create policy "Reservations modification"
  on reservations_consommables for update to authenticated using (true) with check (true);
create policy "Reservations suppression"
  on reservations_consommables for delete to authenticated
  using (exists (select 1 from employee_profiles p
                 where p.id = auth.uid()
                   and p.poste in ('Dirigeant de la société','Responsable magasin')));


-- ---------------------------------------------------------------------
-- 7. QUELQUES RÉFÉRENCES POUR DÉMARRER
--    Stock à 0 : vous ferez votre premier inventaire depuis la page.
--    Adaptez ces lignes à vos vrais produits dans l'onglet « Produits ».
-- ---------------------------------------------------------------------
insert into consommables (categorie, designation, conditionnement, unite, stock_mini, qte_reappro) values
  ('colle',      'Colle carrelage grise',        'sac 25 kg',      'sac',    20, 48),
  ('colle',      'Colle carrelage blanche',      'sac 25 kg',      'sac',    10, 48),
  ('colle',      'Colle souple grands formats',  'sac 25 kg',      'sac',    10, 48),
  ('joint',      'Joint gris',                   'sac 5 kg',       'sac',    15, 30),
  ('joint',      'Joint blanc',                  'sac 5 kg',       'sac',    15, 30),
  ('joint',      'Joint anthracite',             'sac 5 kg',       'sac',    10, 30),
  ('croisillon', 'Croisillons 2 mm',             'sachet 500 pcs', 'sachet',  8, 20),
  ('croisillon', 'Croisillons 3 mm',             'sachet 500 pcs', 'sachet',  8, 20),
  ('croisillon', 'Croisillons 5 mm',             'sachet 250 pcs', 'sachet',  5, 20),
  ('plot',       'Plot réglable 20-30 mm',       'pièce',          'pièce',  50, 200),
  ('plot',       'Plot réglable 30-50 mm',       'pièce',          'pièce',  50, 200),
  ('plot',       'Plot réglable 50-80 mm',       'pièce',          'pièce',  30, 200)
on conflict do nothing;
