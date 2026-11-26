-- GTA 6 Facile — rubrique Glitchs : votes des joueurs et contenu administrable.
-- À exécuter une fois dans Supabase (SQL Editor). Non destructif : rien n'est supprimé, aucune donnée existante n'est modifiée.

-- 1) Votes : un vote par compte et par glitch (modifiable), jamais anonyme, jamais visible en détail par le public.
create table if not exists public.glitch_votes (
  glitch text not null check (glitch ~ '^[a-z0-9][a-z0-9-]{0,80}$'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  resultat text not null check (resultat in ('oui', 'non', 'partiel')),
  plateforme text not null check (plateforme in ('ps5', 'xsx', 'xss')),
  version text check (version ~ '^[0-9.]{3,20}$'),
  mode text not null default 'histoire' check (mode in ('histoire', 'online')),
  date_test date check (date_test <= current_date + 1),
  commentaire text check (char_length(commentaire) <= 500),
  cree timestamptz not null default now(),
  maj timestamptz not null default now(),
  primary key (glitch, user_id)
);
alter table public.glitch_votes enable row level security;
-- droits d'accès de l'API (comme pour la table « espace ») : la sécurité ligne par ligne ci-dessous limite chacun à son propre vote
grant select, insert, update on public.glitch_votes to authenticated;
drop policy if exists "voir mes votes" on public.glitch_votes;
create policy "voir mes votes" on public.glitch_votes for select to authenticated using (user_id = auth.uid());
drop policy if exists "voter" on public.glitch_votes;
create policy "voter" on public.glitch_votes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "modifier mon vote" on public.glitch_votes;
create policy "modifier mon vote" on public.glitch_votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Anti-abus : au plus 20 votes (nouveaux ou modifiés) par compte et par heure.
create or replace function public.glitch_votes_limite() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.glitch_votes where user_id = new.user_id and maj > now() - interval '1 hour') >= 20 then
    raise exception 'limite de votes atteinte';
  end if;
  new.maj := now();
  return new;
end $$;
drop trigger if exists glitch_votes_limite on public.glitch_votes;
create trigger glitch_votes_limite before insert or update on public.glitch_votes for each row execute function public.glitch_votes_limite();

-- Résumé public : uniquement des nombres (aucun compte, aucun commentaire).
create or replace function public.glitch_votes_resume(g text)
returns table (oui bigint, non bigint, partiel bigint, dernier timestamptz)
language sql stable security definer set search_path = public as $$
  select count(*) filter (where resultat = 'oui'), count(*) filter (where resultat = 'non'), count(*) filter (where resultat = 'partiel'), max(maj)
  from public.glitch_votes where glitch = g;
$$;
grant execute on function public.glitch_votes_resume(text) to anon, authenticated;

-- Administration : tous les votes détaillés (sans adresse e-mail), réservé aux administrateurs.
create or replace function public.admin_glitch_votes()
returns table (glitch text, resultat text, plateforme text, version text, mode text, date_test date, commentaire text, maj timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'réservé aux administrateurs'; end if;
  return query select v.glitch, v.resultat, v.plateforme, v.version, v.mode, v.date_test, v.commentaire, v.maj from public.glitch_votes v order by v.maj desc limit 500;
end $$;
grant execute on function public.admin_glitch_votes() to authenticated;

-- 2) Contenu administrable : autoriser les collections « glitchs » et « versions » (versions du jeu).
alter table public.contenu drop constraint if exists contenu_collection_check;
alter table public.contenu add constraint contenu_collection_check
  check (collection in ('actualites', 'astuces', 'codes', 'missions', 'dossiers', 'encyclopedie', 'lieux', 'vehicules', 'glitchs', 'versions'));
