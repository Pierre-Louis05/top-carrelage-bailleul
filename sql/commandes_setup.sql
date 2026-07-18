-- =====================================================================
--  TABLE : commandes
--  Suivi des commandes fournisseurs (carrelage, parquet, sanitaire)
-- =====================================================================
create table if not exists commandes (
  id                uuid default gen_random_uuid() primary key,
  pays              text not null check (pays in ('ESPAGNE','ITALIE','PORTUGAL','PARQUET','SANITAIRE')),
  fournisseur       text not null,
  numero_commande   text,
  client            text,
  date_chantier     text,
  poids_kg          numeric,
  statut            text not null default 'À PAYER AVANT PRÉPARATION'
                    check (statut in (
                      'À PAYER AVANT PRÉPARATION',
                      'PAYÉ',
                      'DEMANDE DE CHARGEMENT',
                      'EN PRÉPARATION',
                      'CHARGÉ',
                      'LIVRAISON',
                      'REÇU / LIVRÉ'
                    )),
  commentaire       text,
  numero_enlevement text,
  delai_prod        text,
  reception_prev    text,
  created_by        uuid references auth.users(id) on delete set null,
  created_by_name   text,
  updated_at        timestamptz default now(),
  updated_by_name   text,
  created_at        timestamptz default now()
);

-- Mise à jour automatique de updated_at
create or replace function update_commandes_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_commandes_updated_at
  before update on commandes
  for each row execute procedure update_commandes_updated_at();

-- ─── Sécurité RLS ─────────────────────────────────────────────────
alter table commandes enable row level security;

-- Toute l'équipe peut consulter toutes les commandes
create policy "Équipe peut voir toutes les commandes"
on commandes for select
to authenticated
using (true);

-- Toute l'équipe peut créer une commande
create policy "Équipe peut créer une commande"
on commandes for insert
to authenticated
with check (true);

-- Toute l'équipe peut mettre à jour (changer le statut, compléter une info)
create policy "Équipe peut modifier une commande"
on commandes for update
to authenticated
using (true)
with check (true);

-- Seuls le Dirigeant et le Responsable peuvent supprimer
create policy "Responsables peuvent supprimer une commande"
on commandes for delete
to authenticated
using (
  exists (
    select 1 from employee_profiles
    where employee_profiles.id = auth.uid()
    and employee_profiles.poste in ('Dirigeant de la société', 'Responsable magasin')
  )
);
