-- =====================================================================
--  EMPLOI DU TEMPS DE L'EQUIPE
--  Qui travaille quand, semaine par semaine.
--
--  A executer UNE SEULE FOIS : Supabase > SQL Editor > coller > Run.
--  Le script peut etre relance sans risque, il ne detruit rien.
-- =====================================================================

-- ---------------------------------------------------------------
--  LES HORAIRES REELS, UNE LIGNE PAR PERSONNE ET PAR JOUR
-- ---------------------------------------------------------------
create table if not exists horaires (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid not null references auth.users(id) on delete cascade,
  employee_name text,
  date date not null,

  creneau text not null check (creneau in (
    'journee',     -- matin et apres-midi
    'matin',       -- 9h-12h
    'apres_midi',  -- 14h-18h30
    'repos',       -- jour de repos
    'formation',   -- semaine d'ecole, pour les alternants
    'perso'        -- horaire sur mesure, renseigne dans debut et fin
  )),

  -- Utilises uniquement quand creneau = 'perso'
  debut time,
  fin time,

  note text,
  maj_par text,
  updated_at timestamptz default now(),

  -- Une seule ligne par personne et par jour
  unique (employee_id, date)
);

create index if not exists idx_horaires_date on horaires (date);

-- ---------------------------------------------------------------
--  LA SEMAINE TYPE
--  Le squelette habituel, qu'on applique a n'importe quelle semaine
--  au lieu de tout ressaisir chaque lundi.
--  jour_semaine : 1 = lundi ... 6 = samedi
-- ---------------------------------------------------------------
create table if not exists horaires_modele (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid not null references auth.users(id) on delete cascade,
  employee_name text,
  jour_semaine int not null check (jour_semaine between 1 and 6),
  creneau text not null check (creneau in
    ('journee','matin','apres_midi','repos','formation','perso')),
  debut time,
  fin time,
  updated_at timestamptz default now(),
  unique (employee_id, jour_semaine)
);

-- La date de derniere modification se met a jour toute seule
create or replace function horaires_touch() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists horaires_touch_trigger on horaires;
create trigger horaires_touch_trigger
  before update on horaires
  for each row execute function horaires_touch();

drop trigger if exists horaires_modele_touch_trigger on horaires_modele;
create trigger horaires_modele_touch_trigger
  before update on horaires_modele
  for each row execute function horaires_touch();

-- ---------------------------------------------------------------
--  SECURITE
--  Toute l'equipe consulte le planning, seuls les responsables le
--  remplissent. C'est un document de reference, pas un brouillon commun.
-- ---------------------------------------------------------------
alter table horaires enable row level security;
alter table horaires_modele enable row level security;

create or replace function est_responsable() returns boolean as $$
  select exists (
    select 1 from employee_profiles
    where employee_profiles.id = auth.uid()
      and employee_profiles.poste in ('Dirigeant de la société', 'Responsable magasin')
  );
$$ language sql security definer stable;

drop policy if exists "Equipe voit les horaires" on horaires;
create policy "Equipe voit les horaires"
on horaires for select to authenticated using (true);

drop policy if exists "Responsables remplissent les horaires" on horaires;
create policy "Responsables remplissent les horaires"
on horaires for all to authenticated
using (est_responsable()) with check (est_responsable());

drop policy if exists "Equipe voit la semaine type" on horaires_modele;
create policy "Equipe voit la semaine type"
on horaires_modele for select to authenticated using (true);

drop policy if exists "Responsables gerent la semaine type" on horaires_modele;
create policy "Responsables gerent la semaine type"
on horaires_modele for all to authenticated
using (est_responsable()) with check (est_responsable());

-- ---------------------------------------------------------------
--  Verification : doit renvoyer les deux tables
-- ---------------------------------------------------------------
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('horaires', 'horaires_modele')
order by table_name;
