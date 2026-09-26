-- ============================================================
--  VEHICULES ET RESERVATIONS
--  A executer une seule fois dans Supabase : SQL Editor, coller, Run.
-- ============================================================

-- Necessaire pour interdire deux reservations qui se chevauchent (voir plus bas)
create extension if not exists btree_gist;

-- ---------- Les vehicules ----------
create table if not exists vehicules (
  id uuid default gen_random_uuid() primary key,
  nom text not null,
  modele text,
  -- Un vehicule marque « exceptionnel » declenche un avertissement avant de
  -- le reserver : c'est le cas du camion gris, le fourgon du patron.
  pret_exceptionnel boolean not null default false,
  ordre int not null default 0,
  actif boolean not null default true,
  created_at timestamptz default now()
);

-- Le parc actuel. Modifier ici s'il change.
insert into vehicules (nom, modele, pret_exceptionnel, ordre)
select 'Camion blanc', 'Renault Master', false, 1
where not exists (select 1 from vehicules where nom = 'Camion blanc');

insert into vehicules (nom, modele, pret_exceptionnel, ordre)
select 'Camion gris', 'Peugeot Expert', true, 2
where not exists (select 1 from vehicules where nom = 'Camion gris');

-- ---------- Les reservations ----------
create table if not exists reservations_vehicules (
  id uuid default gen_random_uuid() primary key,
  vehicule_id uuid not null references vehicules(id) on delete cascade,

  -- interne          : livraison, metrage, un deplacement pour le magasin
  -- pret_client      : le vehicule est prete a un client
  -- emprunt_personnel: un salarie l'emprunte sur son repos
  type text not null check (type in ('interne', 'pret_client', 'emprunt_personnel')),

  debut timestamptz not null,
  fin   timestamptz not null,

  -- Qui detient le vehicule pendant ce creneau
  employee_id uuid references auth.users(id) on delete set null,
  employee_name text,
  client_nom text,
  client_tel text,
  motif text,

  -- Suivi du retour : un vehicule non rendu passe en rouge dans le planning
  rendu boolean not null default false,
  rendu_le timestamptz,

  cree_par text,
  created_at timestamptz default now(),

  constraint dates_coherentes check (fin > debut)
);

-- Le coeur du module : la base elle-meme refuse deux reservations qui se
-- chevauchent sur le meme vehicule. Plus personne ne peut promettre un
-- creneau deja pris, meme en cas de saisie simultanee a deux postes.
alter table reservations_vehicules drop constraint if exists pas_de_double_reservation;
alter table reservations_vehicules
  add constraint pas_de_double_reservation
  exclude using gist (
    vehicule_id with =,
    tstzrange(debut, fin) with &&
  );

create index if not exists idx_reservations_periode
  on reservations_vehicules using gist (tstzrange(debut, fin));

-- ---------- Securite ----------
alter table vehicules enable row level security;
alter table reservations_vehicules enable row level security;

-- Toute l'equipe connectee voit le parc
drop policy if exists "L equipe voit les vehicules" on vehicules;
create policy "L equipe voit les vehicules"
on vehicules for select to authenticated using (true);

-- Toute l'equipe voit le planning : c'est le but, savoir ce qui est libre
drop policy if exists "L equipe voit les reservations" on reservations_vehicules;
create policy "L equipe voit les reservations"
on reservations_vehicules for select to authenticated using (true);

-- Chacun peut reserver
drop policy if exists "L equipe peut reserver" on reservations_vehicules;
create policy "L equipe peut reserver"
on reservations_vehicules for insert to authenticated with check (true);

-- On modifie sa propre reservation ; les responsables modifient tout
drop policy if exists "Modifier sa reservation" on reservations_vehicules;
create policy "Modifier sa reservation"
on reservations_vehicules for update to authenticated
using (
  employee_id = auth.uid()
  or exists (
    select 1 from employee_profiles
    where employee_profiles.id = auth.uid()
      and employee_profiles.poste in ('Dirigeant de la société', 'Responsable magasin')
  )
);

-- Meme regle pour la suppression
drop policy if exists "Supprimer sa reservation" on reservations_vehicules;
create policy "Supprimer sa reservation"
on reservations_vehicules for delete to authenticated
using (
  employee_id = auth.uid()
  or exists (
    select 1 from employee_profiles
    where employee_profiles.id = auth.uid()
      and employee_profiles.poste in ('Dirigeant de la société', 'Responsable magasin')
  )
);
