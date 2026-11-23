-- GTA 6 Facile : espace administrateur
-- À coller une seule fois dans Supabase : SQL Editor > New query > Run.
-- Ensuite, une seule ligne à lancer pour te nommer administrateur (voir tout en bas).

-- 1. Liste des administrateurs (personne ne peut la lire ni la modifier depuis le site)
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.est_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;
revoke all on function public.est_admin() from public;
grant execute on function public.est_admin() to anon, authenticated;

-- 2. Contenu modifié depuis l'administration (lu par le site, écrit seulement par un admin)
create table if not exists public.contenu (
  collection text not null check (collection in ('actualites', 'astuces', 'codes', 'missions', 'dossiers', 'encyclopedie', 'lieux', 'vehicules')),
  cle text not null check (cle ~ '^[a-z0-9][a-z0-9-]{0,80}$'),
  donnees jsonb not null default '{}'::jsonb,
  supprime boolean not null default false,
  maj timestamptz not null default now(),
  primary key (collection, cle),
  constraint contenu_taille check (pg_column_size(donnees) < 100000)
);
alter table public.contenu enable row level security;
drop policy if exists "lire le contenu" on public.contenu;
create policy "lire le contenu" on public.contenu for select to anon, authenticated using (true);
drop policy if exists "admin modifie le contenu" on public.contenu;
create policy "admin modifie le contenu" on public.contenu for all to authenticated using (public.est_admin()) with check (public.est_admin());
revoke all on public.contenu from anon, authenticated;
grant select on public.contenu to anon, authenticated;
grant insert, update, delete on public.contenu to authenticated;

-- 3. Statistiques (réservées à l'admin)
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.est_admin() then raise exception 'réservé à l''administrateur'; end if;
  with f as (
    select x from public.espace e, jsonb_array_elements(case when jsonb_typeof(e.donnees -> 'favs') = 'array' then e.donnees -> 'favs' else '[]'::jsonb end) x
  )
  select jsonb_build_object(
    'comptes', (select count(*) from auth.users),
    'confirmes', (select count(*) from auth.users where email_confirmed_at is not null),
    'nouveaux_7j', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'nouveaux_30j', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'actifs_7j', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'favoris', (select count(*) from f),
    'top_favs', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select x ->> 'type' as type, x ->> 'id' as id, max(x ->> 't') as t, max(x ->> 'u') as u, count(*) as n
      from f group by 1, 2 order by n desc limit 15) t),
    'top_missions', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select m as id, count(*) as n from public.espace e,
        jsonb_array_elements_text(case when jsonb_typeof(e.donnees -> 'missions') = 'array' then e.donnees -> 'missions' else '[]'::jsonb end) m
      group by 1 order by n desc limit 10) t),
    'top_faites', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select d as id, count(*) as n from public.espace e,
        jsonb_array_elements_text(case when jsonb_typeof(e.donnees -> 'done') = 'array' then e.donnees -> 'done' else '[]'::jsonb end) d
      group by 1 order by n desc limit 10) t)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- 4. Comptes visiteurs : liste et suppression (réservées à l'admin)
create or replace function public.admin_comptes()
returns table (uid uuid, adresse text, cree timestamptz, vu timestamptz, confirme boolean, nb_favoris integer, est_admin boolean)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
    coalesce(jsonb_array_length(case when jsonb_typeof(e.donnees -> 'favs') = 'array' then e.donnees -> 'favs' end), 0),
    exists (select 1 from public.admins a where a.user_id = u.id)
  from auth.users u left join public.espace e on e.user_id = u.id
  where (select public.est_admin())
  order by u.created_at desc
$$;
revoke all on function public.admin_comptes() from public, anon;
grant execute on function public.admin_comptes() to authenticated;

create or replace function public.admin_supprimer_compte(cible uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_admin() then raise exception 'réservé à l''administrateur'; end if;
  if exists (select 1 from public.admins where user_id = cible) then raise exception 'impossible de supprimer un administrateur'; end if;
  delete from auth.users where id = cible;
end $$;
revoke all on function public.admin_supprimer_compte(uuid) from public, anon;
grant execute on function public.admin_supprimer_compte(uuid) to authenticated;

-- 5. Te nommer administrateur : crée d'abord ton compte sur le site (Mon espace),
--    puis lance SEULEMENT la ligne ci-dessous dans une nouvelle requête, avec ton adresse e-mail à la place de TON-EMAIL :
-- insert into public.admins (user_id) select id from auth.users where email = 'TON-EMAIL' on conflict do nothing;
