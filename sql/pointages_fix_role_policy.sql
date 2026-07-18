-- Corrige la règle de sécurité (RLS) qui donne au Dirigeant et au Responsable magasin
-- un accès à tous les pointages de l'équipe.
-- Le poste exact en base est "Dirigeant de la société" (et non "Dirigeant").

drop policy if exists "Les responsables peuvent voir tous les pointages" on pointages;

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
