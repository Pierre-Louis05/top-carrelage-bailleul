-- =====================================================================
--  ENTREES ET SORTIES DE L'EQUIPE
--
--  Permet de retirer quelqu'un des plannings sans effacer son historique :
--  ses pointages, ses conges et ses horaires passes restent a son nom.
--  C'est indispensable, ce sont des registres d'heures de travail.
--
--  A executer dans Supabase > SQL Editor. Relancable sans risque.
-- =====================================================================

-- ---------------------------------------------------------------
--  1. L'indicateur actif / inactif
-- ---------------------------------------------------------------
alter table employee_profiles
  add column if not exists actif boolean not null default true;

-- Date de sortie, pour garder la trace sans supprimer la ligne
alter table employee_profiles
  add column if not exists sorti_le date;

comment on column employee_profiles.actif is
  'false : la personne n''apparait plus dans les plannings ni les emplois du temps, mais tout son historique est conserve.';

-- ---------------------------------------------------------------
--  2. Retirer quelqu'un des plannings
--     Un arret de travail n'est PAS une sortie : ne passez actif a false
--     que lorsque la personne a reellement quitte l'entreprise, ou que
--     l'absence est assez longue pour encombrer les plannings.
--     Laissez sorti_le vide tant que le contrat court.
-- ---------------------------------------------------------------
-- Exemple, a decommenter et adapter :
-- update employee_profiles set actif = false
--   where prenom = 'Freddy' and nom = 'Beaurepaire';

-- Pour le faire revenir plus tard :
-- update employee_profiles set actif = true, sorti_le = null
--   where prenom = 'Freddy' and nom = 'Beaurepaire';

-- ---------------------------------------------------------------
--  3. Ajouter quelqu'un
--
--  Etape A, dans l'interface Supabase, PAS ici :
--    Authentication > Users > Add user > Create new user
--    Renseignez son email, cochez « Auto confirm user », et laissez-la
--    choisir son mot de passe a la premiere connexion.
--    Copiez l'identifiant (UID) affiche apres la creation.
--
--  Etape B, ici, en collant l'UID a la place de la valeur d'exemple :
-- ---------------------------------------------------------------
-- insert into employee_profiles (id, prenom, nom, poste, actif)
-- values ('COLLEZ-ICI-L-UID', 'Manon', 'Clémence', 'Conseil salle de bain', true)
-- on conflict (id) do update
--   set prenom = excluded.prenom, nom = excluded.nom,
--       poste = excluded.poste, actif = true;

-- ---------------------------------------------------------------
--  Verification : qui apparait aujourd'hui dans les plannings
-- ---------------------------------------------------------------
select prenom, nom, poste, actif, sorti_le
from employee_profiles
order by actif desc, nom;
