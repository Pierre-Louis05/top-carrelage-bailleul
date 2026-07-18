-- Création de la table des demandes de congés
create table if not exists conges (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid not null references auth.users(id) on delete cascade,
  employee_name text not null,
  date_debut date not null,
  date_fin date not null,
  type text not null default 'Congés payés',
  message text,
  status text not null default 'en_attente' check (status in ('en_attente', 'approuve', 'refuse')),
  reponse_message text,
  traite_par text,
  traite_le timestamptz,
  created_at timestamptz default now(),
  constraint dates_coherentes check (date_fin >= date_debut)
);

-- Active la sécurité au niveau des lignes (RLS)
alter table conges enable row level security;

-- Un collaborateur peut créer ses propres demandes de congé
create policy "Un collaborateur peut créer sa demande de congé"
on conges for insert
to authenticated
with check (employee_id = auth.uid());

-- Un collaborateur peut voir ses propres demandes
create policy "Un collaborateur peut voir ses propres demandes de congé"
on conges for select
to authenticated
using (employee_id = auth.uid());

-- Tout le monde peut voir les congés APPROUVÉS de l'équipe (planning partagé)
create policy "Tout le monde peut voir les congés approuvés de l'équipe"
on conges for select
to authenticated
using (status = 'approuve');

-- Le Dirigeant et le Responsable magasin peuvent voir TOUTES les demandes (y compris en attente)
create policy "Les responsables peuvent voir toutes les demandes de congé"
on conges for select
to authenticated
using (
  exists (
    select 1 from employee_profiles
    where employee_profiles.id = auth.uid()
    and employee_profiles.poste in ('Dirigeant de la société', 'Responsable magasin')
  )
);

-- Le Dirigeant et le Responsable magasin peuvent traiter (approuver/refuser) les demandes
create policy "Les responsables peuvent traiter les demandes de congé"
on conges for update
to authenticated
using (
  exists (
    select 1 from employee_profiles
    where employee_profiles.id = auth.uid()
    and employee_profiles.poste in ('Dirigeant de la société', 'Responsable magasin')
  )
)
with check (
  exists (
    select 1 from employee_profiles
    where employee_profiles.id = auth.uid()
    and employee_profiles.poste in ('Dirigeant de la société', 'Responsable magasin')
  )
);

-- Un collaborateur peut annuler sa propre demande tant qu'elle est encore en attente
create policy "Un collaborateur peut annuler sa demande en attente"
on conges for delete
to authenticated
using (employee_id = auth.uid() and status = 'en_attente');
