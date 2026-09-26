-- =====================================================================
--  PLANNING DU MAGASIN
--  Vehicules, et un seul journal d'evenements pour tout ce qui occupe
--  une personne, un camion, ou le depot.
--
--  A executer UNE SEULE FOIS : Supabase > SQL Editor > coller > Run.
--  Le script peut etre relance sans risque, il ne detruit rien.
-- =====================================================================

-- Permet d'interdire deux reservations qui se chevauchent sur un camion.
create extension if not exists btree_gist;

-- ---------------------------------------------------------------
--  LE PARC
-- ---------------------------------------------------------------
create table if not exists vehicules (
  id uuid default gen_random_uuid() primary key,
  nom text not null unique,
  modele text,
  immatriculation text,
  -- Un vehicule « exceptionnel » declenche un avertissement avant reservation.
  pret_exceptionnel boolean not null default false,
  -- Echeances : le planning previent quand la date approche.
  prochain_ct date,
  prochaine_revision date,
  ordre int not null default 0,
  actif boolean not null default true,
  created_at timestamptz default now()
);

insert into vehicules (nom, modele, pret_exceptionnel, ordre) values
  ('Camion blanc', 'Renault Master', false, 1),
  ('Camion gris',  'Peugeot Expert', true,  2)
on conflict (nom) do nothing;

-- ---------------------------------------------------------------
--  LE JOURNAL D'EVENEMENTS
--  Un seul type de ligne pour tout ce qui se planifie. Selon le type,
--  l'evenement occupe un camion, une personne, ou les deux.
-- ---------------------------------------------------------------
create table if not exists planning_evenements (
  id uuid default gen_random_uuid() primary key,

  type text not null check (type in (
    'rdv_magasin',      -- rendez-vous client au showroom
    'metrage',          -- metrage ou visite de chantier
    'livraison',        -- livraison chez un client
    'enlevement',       -- le client vient chercher sa marchandise au depot
    'reception',        -- arrivee d'un camion fournisseur
    'pret_camion',      -- vehicule prete a un client
    'emprunt_perso',    -- vehicule emprunte par un salarie sur son repos
    'indispo_vehicule', -- garage, revision, controle technique
    'autre'
  )),

  debut timestamptz not null,
  fin   timestamptz not null,

  -- Ressources mobilisees. Les deux peuvent etre nulles (un enlevement au
  -- depot n'occupe ni camion ni commercial en particulier).
  vehicule_id uuid references vehicules(id) on delete set null,
  employee_id uuid references auth.users(id) on delete set null,
  employee_name text,

  -- Le tiers concerne
  client_nom text,
  client_tel text,
  adresse text,

  -- Rattachement a une commande, un bon de livraison, un numero d'enlevement
  reference text,
  poids_kg numeric,

  titre text,
  notes text,

  statut text not null default 'prevu'
    check (statut in ('prevu', 'en_cours', 'termine', 'annule')),

  -- Suivi du retour, pour les prets et les emprunts
  rendu boolean not null default false,
  rendu_le timestamptz,

  cree_par text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint dates_coherentes check (fin > debut)
);

-- Le coeur du module : la base refuse deux evenements qui se chevauchent
-- sur le meme camion. Les evenements annules et ceux sans vehicule ne
-- comptent pas. Plus personne ne peut promettre un creneau deja pris,
-- meme si deux postes saisissent en meme temps.
alter table planning_evenements drop constraint if exists un_camion_a_la_fois;
alter table planning_evenements
  add constraint un_camion_a_la_fois
  exclude using gist (
    vehicule_id with =,
    tstzrange(debut, fin) with &&
  ) where (vehicule_id is not null and statut <> 'annule');

create index if not exists idx_planning_periode
  on planning_evenements using gist (tstzrange(debut, fin));
create index if not exists idx_planning_debut
  on planning_evenements (debut);

-- La date de derniere modification se met a jour toute seule
create or replace function planning_touch() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists planning_touch_trigger on planning_evenements;
create trigger planning_touch_trigger
  before update on planning_evenements
  for each row execute function planning_touch();

-- ---------------------------------------------------------------
--  SECURITE
--  Le planning est un outil commun : toute l'equipe connectee le voit et
--  peut y ajouter. On ne modifie que ce qu'on a cree, sauf les responsables.
-- ---------------------------------------------------------------
alter table vehicules enable row level security;
alter table planning_evenements enable row level security;

drop policy if exists "Equipe voit les vehicules" on vehicules;
create policy "Equipe voit les vehicules"
on vehicules for select to authenticated using (true);

drop policy if exists "Responsables gerent les vehicules" on vehicules;
create policy "Responsables gerent les vehicules"
on vehicules for all to authenticated
using (
  exists (select 1 from employee_profiles
          where employee_profiles.id = auth.uid()
            and employee_profiles.poste in ('Dirigeant de la société', 'Responsable magasin'))
);

drop policy if exists "Equipe voit le planning" on planning_evenements;
create policy "Equipe voit le planning"
on planning_evenements for select to authenticated using (true);

drop policy if exists "Equipe ajoute au planning" on planning_evenements;
create policy "Equipe ajoute au planning"
on planning_evenements for insert to authenticated with check (true);

drop policy if exists "Modifier ses evenements" on planning_evenements;
create policy "Modifier ses evenements"
on planning_evenements for update to authenticated
using (
  employee_id = auth.uid()
  or exists (select 1 from employee_profiles
             where employee_profiles.id = auth.uid()
               and employee_profiles.poste in ('Dirigeant de la société', 'Responsable magasin'))
);

drop policy if exists "Supprimer ses evenements" on planning_evenements;
create policy "Supprimer ses evenements"
on planning_evenements for delete to authenticated
using (
  employee_id = auth.uid()
  or exists (select 1 from employee_profiles
             where employee_profiles.id = auth.uid()
               and employee_profiles.poste in ('Dirigeant de la société', 'Responsable magasin'))
);

-- ---------------------------------------------------------------
--  Verification : doit renvoyer les deux camions
-- ---------------------------------------------------------------
select nom, modele, pret_exceptionnel from vehicules order by ordre;
