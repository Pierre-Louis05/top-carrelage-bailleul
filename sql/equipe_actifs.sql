-- =====================================================================
--  ENTREES ET SORTIES DE L'EQUIPE
--
--  Retirer quelqu'un des plannings sans effacer son historique : ses
--  pointages, ses conges et ses horaires passes restent a son nom.
--  C'est indispensable, ce sont des registres d'heures de travail.
--
--  A executer dans Supabase > SQL Editor. Relancable sans risque.
-- =====================================================================

-- ---------------------------------------------------------------
--  1. L'indicateur actif / inactif
-- ---------------------------------------------------------------
alter table employee_profiles
  add column if not exists actif boolean not null default true;

alter table employee_profiles
  add column if not exists sorti_le date;

comment on column employee_profiles.actif is
  'false : n''apparait plus dans les plannings ni l''emploi du temps, mais tout l''historique est conserve.';

-- ---------------------------------------------------------------
--  2. FREDDY EN STAND-BY
--     Il disparait des plannings, son historique reste intact.
--     sorti_le reste vide : ce n'est pas un depart, son contrat court.
-- ---------------------------------------------------------------
update employee_profiles
set actif = false
where prenom = 'Freddy' and nom = 'Beaurepaire';

-- Pour le faire revenir le jour ou il reprend :
--   update employee_profiles set actif = true
--   where prenom = 'Freddy' and nom = 'Beaurepaire';

-- ---------------------------------------------------------------
--  3. CREER MANON
--
--  ETAPE A, dans l'interface Supabase, PAS ici :
--    Authentication > Users > Add user > Create new user
--    Saisissez son adresse email professionnelle,
--    cochez « Auto Confirm User », validez.
--
--  ETAPE B, ici : remplacez l'adresse ci-dessous par la sienne,
--  exactement la meme qu'a l'etape A, puis relancez le script.
--  Si l'adresse ne correspond a aucun compte, rien ne se passe,
--  aucun risque.
-- ---------------------------------------------------------------
insert into employee_profiles (id, prenom, nom, poste, actif)
select u.id, 'Manon', 'Clémence', 'Conseil salle de bain & sanitaire', true
from auth.users u
where u.email = 'adresse-de-manon@a-remplacer.fr'
on conflict (id) do update
  set prenom = excluded.prenom,
      nom    = excluded.nom,
      poste  = excluded.poste,
      actif  = true;

-- ---------------------------------------------------------------
--  Verification : qui apparait aujourd'hui dans les plannings
-- ---------------------------------------------------------------
select prenom, nom, poste,
       case when actif then 'dans les plannings' else 'en stand-by' end as etat
from employee_profiles
order by actif desc, nom;
