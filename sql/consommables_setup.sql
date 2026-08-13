-- =====================================================================
--  STOCK DES CONSOMMABLES
--  colles · joints · croisillons · plots
-- ---------------------------------------------------------------------
--  Principe, volontairement simple :
--    on reçoit de la marchandise   ->  on l'enregistre en PLUS
--    on charge un client           ->  on l'enregistre en MOINS
--    le stock se recalcule tout seul à chaque mouvement.
--
--  Chaque référence a un seuil de sécurité : dès que le stock descend
--  à ce niveau, elle bascule dans la liste « À commander ».
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. LES PRODUITS ET LEURS NIVEAUX
-- ---------------------------------------------------------------------
create table if not exists consommables (
  id               uuid primary key default gen_random_uuid(),
  categorie        text not null check (categorie in ('colle','joint','croisillon','plot','autre')),
  reference        text,
  designation      text not null,
  conditionnement  text,                            -- « sac 25 kg », « seau 5 kg », « sachet 500 pcs »
  unite            text not null default 'unité',   -- sac, seau, sachet, pièce…

  stock_reel       numeric not null default 0,      -- jamais saisi à la main : tenu par les mouvements
  stock_mini       numeric not null default 0,      -- seuil de sécurité
  qte_reappro      numeric,                         -- conditionnement de commande (ex : 48 = 1 palette)
  fournisseur      text,

  actif            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_consommables_categorie on consommables(categorie) where actif;


-- ---------------------------------------------------------------------
-- 2. LES MOUVEMENTS
--    quantite est SIGNÉE : positive quand ça entre, négative quand ça sort.
--    C'est ce qui garantit qu'on ne peut pas se tromper de sens.
-- ---------------------------------------------------------------------
create table if not exists mouvements_consommables (
  id              uuid primary key default gen_random_uuid(),
  consommable_id  uuid not null references consommables(id) on delete cascade,
  type            text not null check (type in ('entree','sortie','inventaire')),
  quantite        numeric not null check (quantite <> 0),
  stock_apres     numeric,                          -- niveau atteint après ce mouvement
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
-- 3. LE STOCK SE MET À JOUR TOUT SEUL
--    Le stock n'est jamais écrit directement : il est recalculé par la
--    base à chaque mouvement. Même à plusieurs au comptoir, il reste juste.
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


-- ---------------------------------------------------------------------
-- 4. VUE DE PILOTAGE
-- ---------------------------------------------------------------------
create or replace view v_etat_stock as
select
  c.*,
  case
    when c.stock_reel <= 0             then 'rupture'
    when c.stock_reel <= c.stock_mini  then 'a_commander'
    else 'ok'
  end                                              as etat,
  greatest(c.stock_mini - c.stock_reel, 0)         as manque
from consommables c
where c.actif;


-- ---------------------------------------------------------------------
-- 5. SÉCURITÉ (RLS) : réservé aux collaborateurs connectés
-- ---------------------------------------------------------------------
alter table consommables            enable row level security;
alter table mouvements_consommables enable row level security;

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


-- ---------------------------------------------------------------------
-- 6. QUELQUES RÉFÉRENCES POUR DÉMARRER
--    Stock à 0 : vous poserez les vraies quantités avec le premier
--    inventaire depuis la page. Adaptez ces lignes à vos produits.
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
