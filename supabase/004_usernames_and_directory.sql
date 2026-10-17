-- Lexa 004: usernames chosen at sign-up + admins listed as teachers.
-- Run after 002 and 003 in the Supabase SQL editor (safe to re-run).

-- 1) every new auth user gets a profile row; the username typed on the sign-up
--    form (user metadata "username") is used when it is valid and free,
--    otherwise the default "u..." name (the user can change it later)
create or replace function public.lexa_on_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  want text := trim(coalesce(new.raw_user_meta_data->>'username', ''));
  uname text := public.lexa_default_username(new.id);
begin
  if char_length(want) between 3 and 20
     and want ~ '^[a-zA-Z0-9_\u0600-\u06FF][a-zA-Z0-9_.\u0600-\u06FF]*$'
     and want !~* '^u[0-9a-f]{10}$'
     and not exists (select 1 from public.lexa_profiles where lower(username) = lower(want)) then
    uname := want;
  end if;
  begin
    insert into public.lexa_profiles (id, username) values (new.id, uname)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.lexa_profiles (id, username) values (new.id, public.lexa_default_username(new.id))
    on conflict (id) do nothing;
  end;
  return new;
end $$;

-- 2) teacher directory: admins teach too (they can publish), so list them
create or replace function public.lexa_teacher_directory(q text default '', lim int default 60)
returns table (id uuid, username text, display_name text, bio text, avatar_url text,
               followers bigint, posts bigint, courses bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.bio, p.avatar_url,
    (select count(*) from public.lexa_follows f where f.teacher_id = p.id) as followers,
    (select count(*) from public.lexa_posts x where x.author_id = p.id) as posts,
    (select count(*) from public.lexa_tcourses c where c.teacher_id = p.id and c.status <> 'draft') as courses
  from public.lexa_profiles p
  where p.role in ('teacher', 'admin')
    and (coalesce(q, '') = '' or p.display_name ilike '%' || q || '%' or p.username ilike '%' || q || '%')
  order by followers desc, posts desc, p.created_at asc
  limit greatest(1, least(coalesce(lim, 60), 200))
$$;

grant execute on function public.lexa_teacher_directory(text, integer) to anon, authenticated;
revoke execute on function public.lexa_on_auth_user() from public, anon, authenticated;
