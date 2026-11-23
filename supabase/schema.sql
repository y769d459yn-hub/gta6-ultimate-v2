-- Leonida Guide : comptes visiteurs et favoris synchronisés
-- À coller une seule fois dans Supabase : SQL Editor > New query > Run.

-- 1. Une ligne par utilisateur : ses favoris et sa progression
create table if not exists public.espace (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  donnees jsonb not null default '{}'::jsonb, -- favoris, astuces faites, missions faites, objets trouvés sur la carte
  maj timestamptz not null default now()
);

-- 2. Sécurité : chacun ne voit et ne modifie que sa propre ligne
alter table public.espace enable row level security;

drop policy if exists "lire mon espace" on public.espace;
create policy "lire mon espace" on public.espace for select to authenticated using (user_id = auth.uid());
drop policy if exists "créer mon espace" on public.espace;
create policy "créer mon espace" on public.espace for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "modifier mon espace" on public.espace;
create policy "modifier mon espace" on public.espace for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "vider mon espace" on public.espace;
create policy "vider mon espace" on public.espace for delete to authenticated using (user_id = auth.uid());

revoke all on public.espace from anon;
grant select, insert, update, delete on public.espace to authenticated;

-- 3. Taille raisonnable (pas de données géantes envoyées par un visiteur)
alter table public.espace drop constraint if exists espace_taille;
alter table public.espace add constraint espace_taille check (pg_column_size(donnees) < 300000);

-- 4. Supprimer son compte soi-même (bouton « Supprimer mon compte »)
create or replace function public.supprimer_mon_compte()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
