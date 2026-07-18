-- Création de la table des témoignages clients
create table if not exists testimonials (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  prenom text not null,
  nom text not null,
  email text not null,
  note int not null check (note >= 1 and note <= 5),
  message text not null,
  status text default 'en_attente'
);

-- Active la sécurité au niveau des lignes (RLS)
alter table testimonials enable row level security;

-- Tout le monde (visiteurs du site) peut envoyer un témoignage
create policy "Tout le monde peut envoyer un temoignage"
on testimonials for insert
to anon, authenticated
with check (true);

-- Tout le monde peut lire UNIQUEMENT les témoignages approuvés (pour la galerie publique)
create policy "Tout le monde peut lire les temoignages approuves"
on testimonials for select
to anon, authenticated
using (status = 'approuve');

-- Les collaborateurs connectés peuvent tout lire (y compris en attente / rejetés) pour modérer
create policy "Les collaborateurs peuvent lire tous les temoignages"
on testimonials for select
to authenticated
using (true);

-- Les collaborateurs connectés peuvent modifier le statut (approuver / rejeter / restaurer)
create policy "Les collaborateurs peuvent modifier les temoignages"
on testimonials for update
to authenticated
using (true)
with check (true);

-- Les collaborateurs connectés peuvent supprimer un témoignage
create policy "Les collaborateurs peuvent supprimer les temoignages"
on testimonials for delete
to authenticated
using (true);
