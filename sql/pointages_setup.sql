-- Création de la table des pointages
create table if not exists pointages (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid not null references auth.users(id) on delete cascade,
  employee_name text not null,
  date date not null default current_date,
  arrivee timestamptz,
  pause_debut timestamptz,
  pause_fin timestamptz,
  depart timestamptz,
  created_at timestamptz default now(),
  unique (employee_id, date)
);

-- Active la sécurité au niveau des lignes (RLS)
alter table pointages enable row level security;

-- Chaque collaborateur peut enregistrer SES PROPRES pointages
create policy "Un collaborateur peut enregistrer son pointage"
on pointages for insert
to authenticated
with check (employee_id = auth.uid());

-- Chaque collaborateur peut modifier SES PROPRES pointages du jour
create policy "Un collaborateur peut modifier son pointage"
on pointages for update
to authenticated
using (employee_id = auth.uid())
with check (employee_id = auth.uid());

-- Chaque collaborateur peut voir SES PROPRES pointages
create policy "Un collaborateur peut voir ses propres pointages"
on pointages for select
to authenticated
using (employee_id = auth.uid());

-- Le Dirigeant et le Responsable magasin peuvent voir TOUS les pointages de l'équipe
create policy "Les responsables peuvent voir tous les pointages"
on pointages for select
to authenticated
using (
  exists (
    select 1 from employee_profiles
    where employee_profiles.id = auth.uid()
    and employee_profiles.poste in ('Dirigeant de la société', 'Responsable magasin')
  )
);
