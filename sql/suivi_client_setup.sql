-- ============================================================================
--  SUIVI CLIENT  -  LOT 1 : dossiers, projets, documents, fiche de passage
-- ----------------------------------------------------------------------------
--  Sequoia reste la reference : clients, devis, commandes, factures et produits
--  y restent. Ces tables n'en sont pas une copie, elles ajoutent ce que Sequoia
--  ne suit pas : le premier passage avant tout devis, l'etape du projet, les
--  notes, l'historique des actions.
--
--  A executer dans Supabase > SQL Editor. Relancable sans risque.
-- ============================================================================

-- ---------------------------------------------------------------
--  0. Le nom du vendeur tel que Sequoia l'ecrit
--     Le champ « Commercial : » des PDF contient un prenom en capitales.
--     On le relie au compte de l'espace equipe pour attribuer les documents
--     automatiquement. LOUIS et LOUISE sont deux personnes differentes :
--     la correspondance est exacte, jamais un debut de mot.
-- ---------------------------------------------------------------
alter table employee_profiles
  add column if not exists nom_sequoia text;

comment on column employee_profiles.nom_sequoia is
  'Prenom en capitales tel qu''il apparait apres « Commercial : » sur les PDF Sequoia. Correspondance exacte.';

create unique index if not exists employee_profiles_nom_sequoia_unique
  on employee_profiles (upper(nom_sequoia)) where nom_sequoia is not null;

-- ---------------------------------------------------------------
--  1. Dossiers clients
--     Sequoia ne numerote pas ses clients. On reconnait donc par telephone
--     normalise d'abord, puis par nom et adresse. Le telephone normalise est
--     stocke a part pour que « 06 12 34 56 78 » et « +33 6 12 34 56 78 »
--     tombent sur le meme dossier.
-- ---------------------------------------------------------------
create table if not exists suivi_clients (
  id              uuid primary key default gen_random_uuid(),
  nom             text not null,
  telephone       text,                      -- tel que saisi, pour l'affichage
  telephone_norme text,                      -- chiffres seuls, 0612345678
  email           text,
  adresse         text,
  code_postal     text,
  ville           text,
  type_client     text not null default 'particulier'
                  check (type_client in ('particulier', 'professionnel')),
  societe         text,
  note            text,
  cree_le         timestamptz not null default now(),
  cree_par        uuid references auth.users(id),
  maj_le          timestamptz not null default now()
);

create index if not exists suivi_clients_tel     on suivi_clients (telephone_norme);
create index if not exists suivi_clients_nom     on suivi_clients (lower(nom));
create index if not exists suivi_clients_maj     on suivi_clients (maj_le desc);

-- ---------------------------------------------------------------
--  2. Projets
--     Un client peut revenir pour un autre chantier : chaque projet a son
--     etape, ses documents et ses relances. Les champs de la fiche de passage
--     vivent ici plutot que dans une table a part : un passage EST un projet
--     qui commence, et les dupliquer compliquerait la reprise par un collegue.
-- ---------------------------------------------------------------
create table if not exists suivi_projets (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references suivi_clients(id) on delete cascade,
  titre           text not null,
  univers         text check (univers in ('carrelage', 'sanitaire', 'parquet', 'pierre', 'autre')),
  type_projet     text,                      -- Salle de bain, Sol interieur, Terrasse...
  etape           text not null default 'premier_passage'
                  check (etape in ('premier_passage','devis_envoye','en_relance',
                                   'signe','facture','apres_vente','en_sommeil','perdu')),
  vendeur_id      uuid references auth.users(id),
  montant_ht      numeric(12,2),
  montant_ttc     numeric(12,2),

  -- Fiche de passage
  canal_prefere   text check (canal_prefere in ('telephone', 'mail')),
  surface         numeric(10,2),
  budget          text,                      -- moins_2k, 2_5k, 5_10k, plus_10k
  echeance        text,                      -- urgent, moins_3_mois, plus_tard
  provenance      text,                      -- passage, site, google, bouche_a_oreille, autre
  artisan_nom     text,                      -- facultatif : le poseur du client
  artisan_tel     text,
  note            text,

  -- Sortie du parcours
  raison_perdu    text check (raison_perdu in ('prix','delai','concurrent','abandonne','autre')),
  detail_perdu    text,

  cree_le         timestamptz not null default now(),
  cree_par        uuid references auth.users(id),
  maj_le          timestamptz not null default now()
);

create index if not exists suivi_projets_client  on suivi_projets (client_id);
create index if not exists suivi_projets_etape   on suivi_projets (etape);
create index if not exists suivi_projets_vendeur on suivi_projets (vendeur_id);
create index if not exists suivi_projets_maj     on suivi_projets (maj_le desc);

-- ---------------------------------------------------------------
--  3. Documents Sequoia
--     Les lignes sont rangees en jsonb plutot qu'en table separee : on les lit
--     toujours entieres, avec le document. Postgres sait les interroger le
--     jour ou on voudra les produits les plus vendus.
-- ---------------------------------------------------------------
create table if not exists suivi_documents (
  id              uuid primary key default gen_random_uuid(),
  projet_id       uuid not null references suivi_projets(id) on delete cascade,
  type_doc        text not null check (type_doc in ('devis', 'commande', 'facture')),
  numero          text not null,             -- DM08044, CM00xxxx, FM...
  date_doc        date,
  date_expiration date,                      -- devis valable 8 jours
  total_ht        numeric(12,2),
  total_ttc       numeric(12,2),
  acompte         numeric(12,2),
  reste_a_payer   numeric(12,2),
  echeance        date,
  poids_kg        numeric(10,2),
  lignes          jsonb not null default '[]'::jsonb,
  numero_lie      text,                      -- commande -> devis, facture -> commande
  texte_brut      text,                      -- ce que le lecteur de PDF a extrait
  fichier_nom     text,
  depose_le       timestamptz not null default now(),
  depose_par      uuid references auth.users(id)
);

create unique index if not exists suivi_documents_numero on suivi_documents (upper(numero));
create index if not exists suivi_documents_projet on suivi_documents (projet_id);
create index if not exists suivi_documents_type   on suivi_documents (type_doc, date_doc desc);

-- ---------------------------------------------------------------
--  4. Historique
--     Regle 5 des agents : chaque action est inscrite, avec qui et quand.
--     C'est aussi ce qui permet a un collegue de reprendre un dossier.
-- ---------------------------------------------------------------
create table if not exists suivi_historique (
  id          uuid primary key default gen_random_uuid(),
  projet_id   uuid not null references suivi_projets(id) on delete cascade,
  type_action text not null,                 -- passage, depot, etape, note, appel, mail, echantillon
  texte       text not null,
  auteur_id   uuid references auth.users(id),
  cree_le     timestamptz not null default now()
);

create index if not exists suivi_historique_projet on suivi_historique (projet_id, cree_le desc);

-- ---------------------------------------------------------------
--  5. Echantillons pretes
--     L'ecran arrive au lot 2, mais la fiche de passage les saisit deja.
-- ---------------------------------------------------------------
create table if not exists suivi_echantillons (
  id          uuid primary key default gen_random_uuid(),
  projet_id   uuid not null references suivi_projets(id) on delete cascade,
  designation text not null,
  caution     numeric(10,2) default 0,
  prete_le    date not null default current_date,
  rendu_le    date,
  cree_par    uuid references auth.users(id)
);

create index if not exists suivi_echantillons_dehors
  on suivi_echantillons (prete_le) where rendu_le is null;

-- ---------------------------------------------------------------
--  6. maj_le se met a jour tout seul
-- ---------------------------------------------------------------
create or replace function suivi_touch() returns trigger as $$
begin
  new.maj_le = now();
  return new;
end $$ language plpgsql;

drop trigger if exists suivi_clients_touch on suivi_clients;
create trigger suivi_clients_touch before update on suivi_clients
  for each row execute function suivi_touch();

drop trigger if exists suivi_projets_touch on suivi_projets;
create trigger suivi_projets_touch before update on suivi_projets
  for each row execute function suivi_touch();

-- Un document depose remonte aussi la date du projet et du client, pour que
-- les dossiers actifs restent en haut des listes.
create or replace function suivi_document_remonte() returns trigger as $$
begin
  update suivi_projets set maj_le = now() where id = new.projet_id;
  update suivi_clients set maj_le = now()
   where id = (select client_id from suivi_projets where id = new.projet_id);
  return new;
end $$ language plpgsql;

drop trigger if exists suivi_documents_remonte on suivi_documents;
create trigger suivi_documents_remonte after insert on suivi_documents
  for each row execute function suivi_document_remonte();

-- ---------------------------------------------------------------
--  7. Acces
--     Tout le monde voit tous les clients, pour qu'un collegue puisse
--     reprendre un dossier en cas d'absence. C'est une decision du magasin.
--     Seule la suppression est reservee aux responsables.
-- ---------------------------------------------------------------
alter table suivi_clients      enable row level security;
alter table suivi_projets      enable row level security;
alter table suivi_documents    enable row level security;
alter table suivi_historique   enable row level security;
alter table suivi_echantillons enable row level security;

do $$
declare t text;
begin
  foreach t in array array['suivi_clients','suivi_projets','suivi_documents',
                           'suivi_historique','suivi_echantillons']
  loop
    execute format('drop policy if exists "Equipe lit %1$s" on %1$s', t);
    execute format('drop policy if exists "Equipe ecrit %1$s" on %1$s', t);
    execute format('drop policy if exists "Equipe modifie %1$s" on %1$s', t);
    execute format('drop policy if exists "Responsables suppriment %1$s" on %1$s', t);

    execute format('create policy "Equipe lit %1$s" on %1$s
                    for select to authenticated using (true)', t);
    execute format('create policy "Equipe ecrit %1$s" on %1$s
                    for insert to authenticated with check (true)', t);
    execute format('create policy "Equipe modifie %1$s" on %1$s
                    for update to authenticated using (true) with check (true)', t);
    execute format('create policy "Responsables suppriment %1$s" on %1$s
                    for delete to authenticated using (est_responsable())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------
--  8. Effacement au bout de trois ans
--     Les mentions legales annoncent trois ans. La tache existante ne couvre
--     que contact_requests et rdv_requests : on l'etend a ces tables. La date
--     prise en compte est la derniere activite du dossier, pas sa creation :
--     un client suivi pendant quatre ans n'est pas efface au milieu.
-- ---------------------------------------------------------------
do $$
begin
  perform cron.unschedule('purge-donnees-clients');
exception when others then
  null;
end $$;

select cron.schedule(
  'purge-donnees-clients',
  '0 3 * * *',
  $$
    delete from public.contact_requests where created_at < now() - interval '3 years';
    delete from public.rdv_requests     where created_at < now() - interval '3 years';
    delete from public.suivi_clients    where maj_le     < now() - interval '3 years';
  $$
);

-- ---------------------------------------------------------------
--  9. Relier les vendeurs a leur nom Sequoia
--     A ajuster apres avoir regarde un vrai PDF de chacun. LOUIS et LOUISE
--     doivent rester distincts.
-- ---------------------------------------------------------------
update employee_profiles set nom_sequoia = 'JEREMIE'      where prenom = 'Jérémie';
update employee_profiles set nom_sequoia = 'SIMON'        where prenom = 'Simon';
update employee_profiles set nom_sequoia = 'LOUISE'       where prenom = 'Louise';
update employee_profiles set nom_sequoia = 'LOUIS'        where prenom = 'Louis';
update employee_profiles set nom_sequoia = 'MANON'        where prenom = 'Manon';
update employee_profiles set nom_sequoia = 'FREDDY'       where prenom = 'Freddy';
update employee_profiles set nom_sequoia = 'PIERRE-LOUIS' where prenom = 'Pierre-Louis';

-- ---------------------------------------------------------------
--  Verification
-- ---------------------------------------------------------------
select prenom, nom, nom_sequoia,
       case when actif then 'actif' else 'stand-by' end as etat
from employee_profiles order by nom_sequoia nulls last;
