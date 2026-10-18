-- Lexa 007: content visibility (phase 2 of docs/ORG_LEARNING.md). Run after 006. Safe to re-run.
--
-- Every post and teacher course gets a visibility level:
--   public  everyone, also signed-out visitors (the default, so nothing changes for old rows)
--   users   any signed-in Lexa user
--   org     the centre in org_id: its official students with access right now
--           (lexa_org_official from 006), its active teachers / managers, the author, Lexa admins
--   draft   only the author, the centre's managers and Lexa admins
-- A course with visibility org and allow_preview shows its card (never its lessons) to
-- everyone through lexa_org_course_previews, labelled "for students of <centre>".
-- Class-level visibility comes with classes in phase 3.
-- Org media go to the private bucket lexa-org-media (signed URLs, 10 minutes).

-- --- columns ---
alter table public.lexa_posts add column if not exists visibility text not null default 'public';
alter table public.lexa_tcourses add column if not exists visibility text not null default 'public';
alter table public.lexa_tcourses add column if not exists allow_preview boolean not null default false;
do $$ begin
  alter table public.lexa_posts add constraint lexa_posts_visibility_chk
    check (visibility in ('public', 'users', 'org', 'draft'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.lexa_tcourses add constraint lexa_tcourses_visibility_chk
    check (visibility in ('public', 'users', 'org', 'draft'));
exception when duplicate_object then null; end $$;
create index if not exists lexa_posts_visibility_idx on public.lexa_posts (visibility);
create index if not exists lexa_tcourses_visibility_idx on public.lexa_tcourses (visibility);

-- active teacher / manager / owner of the centre
create or replace function public.lexa_org_active_member(o uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select o is not null and exists (
    select 1 from public.lexa_org_members
    where org_id = o and user_id = auth.uid() and status = 'active'
  )
$$;

-- may the caller read an item with this visibility, centre and author?
create or replace function public.lexa_can_see(vis text, o uuid, author uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case coalesce(vis, 'public')
    when 'public' then true
    when 'users' then auth.uid() is not null
    when 'org' then auth.uid() is not null and (
      author = auth.uid() or public.lexa_is_admin()
      or (o is not null and (public.lexa_org_active_member(o) or public.lexa_org_official(o))))
    when 'draft' then auth.uid() is not null and (
      author = auth.uid() or public.lexa_is_admin()
      or (o is not null and public.lexa_org_can_manage(o)))
    else false
  end
$$;

-- centre-only items need a centre the author may publish under
create or replace function public.lexa_visibility_guard()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null
     and (tg_op = 'INSERT' or new.visibility is distinct from old.visibility or new.org_id is distinct from old.org_id)
     and new.visibility = 'org' and new.org_id is null then
    raise exception 'org visibility needs an organisation';
  end if;
  return new;
end $$;
drop trigger if exists lexa_posts_visibility_guard on public.lexa_posts;
create trigger lexa_posts_visibility_guard before insert or update on public.lexa_posts
  for each row execute function public.lexa_visibility_guard();
drop trigger if exists lexa_tcourses_visibility_guard on public.lexa_tcourses;
create trigger lexa_tcourses_visibility_guard before insert or update on public.lexa_tcourses
  for each row execute function public.lexa_visibility_guard();

-- --- read policies ---
drop policy if exists "posts read" on public.lexa_posts;
create policy "posts read" on public.lexa_posts for select using (
  public.lexa_can_see(visibility, org_id, author_id)
);

drop policy if exists "tcourses read" on public.lexa_tcourses;
create policy "tcourses read" on public.lexa_tcourses for select using (
  teacher_id = auth.uid() or public.lexa_is_admin()
  or (status <> 'draft' and public.lexa_can_see(visibility, org_id, teacher_id))
);

-- comments follow their post (the subquery runs under the caller's RLS)
drop policy if exists "comments read" on public.lexa_comments;
create policy "comments read" on public.lexa_comments for select using (
  exists (select 1 from public.lexa_posts p where p.id = post_id)
);
drop policy if exists "comments insert own" on public.lexa_comments;
create policy "comments insert own" on public.lexa_comments for insert with check (
  user_id = auth.uid() and exists (select 1 from public.lexa_posts p where p.id = post_id)
);

-- a course can only be added to the library while it is visible
drop policy if exists "library own" on public.lexa_library;
drop policy if exists "library read own" on public.lexa_library;
drop policy if exists "library insert visible" on public.lexa_library;
drop policy if exists "library delete own" on public.lexa_library;
create policy "library read own" on public.lexa_library for select using (user_id = auth.uid());
create policy "library insert visible" on public.lexa_library for insert with check (
  user_id = auth.uid() and exists (select 1 from public.lexa_tcourses c where c.id = course_id)
);
create policy "library delete own" on public.lexa_library for delete using (user_id = auth.uid());

-- ratings only on items the caller can see
create or replace function public.lexa_ratings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'post' then
    if not exists (select 1 from public.lexa_posts p
                   where p.id = new.target_id and public.lexa_can_see(p.visibility, p.org_id, p.author_id)) then
      raise exception 'rating target not found';
    end if;
  elsif new.target_type = 'tcourse' then
    if not exists (
      select 1 from public.lexa_tcourses c
      where c.id = new.target_id
        and (c.teacher_id = auth.uid() or public.lexa_is_admin()
             or (c.status <> 'draft' and public.lexa_can_see(c.visibility, c.org_id, c.teacher_id)))
    ) then
      raise exception 'rating target not found';
    end if;
  else
    raise exception 'bad rating target type';
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- aggregates never reveal hidden items
create or replace function public.lexa_rating_aggs(t text, ids uuid[])
returns table (target_id uuid, avg numeric, cnt bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if t not in ('post', 'tcourse') then raise exception 'bad rating target type'; end if;
  if coalesce(cardinality(ids), 0) > 200 then raise exception 'too many ids'; end if;
  return query
    select r.target_id, round(avg(r.stars)::numeric, 1), count(*)
    from public.lexa_ratings r
    where r.target_type = t and r.target_id = any(coalesce(ids, '{}'::uuid[]))
      and ((t = 'post' and exists (
              select 1 from public.lexa_posts p
              where p.id = r.target_id and public.lexa_can_see(p.visibility, p.org_id, p.author_id)))
        or (t = 'tcourse' and exists (
              select 1 from public.lexa_tcourses c
              where c.id = r.target_id
                and (c.teacher_id = auth.uid() or public.lexa_is_admin()
                     or (c.status <> 'draft' and public.lexa_can_see(c.visibility, c.org_id, c.teacher_id))))))
    group by r.target_id;
end $$;

create or replace function public.lexa_course_students(ids uuid[])
returns table (course_id uuid, students bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(cardinality(ids), 0) > 200 then raise exception 'too many ids'; end if;
  return query
    select l.course_id, count(*)
    from public.lexa_library l
    join public.lexa_tcourses c on c.id = l.course_id
    where l.course_id = any(coalesce(ids, '{}'::uuid[]))
      and (c.teacher_id = auth.uid() or public.lexa_is_admin()
           or (c.status <> 'draft' and public.lexa_can_see(c.visibility, c.org_id, c.teacher_id)))
    group by l.course_id;
end $$;

-- public cards of centre-only courses that opted into a preview (no chapters)
create or replace function public.lexa_org_course_previews(o uuid default null, lim int default 60)
returns table (id uuid, title text, tagline text, icon text, accent text, thumbnail text,
               categories jsonb, teacher_id uuid, org_id uuid, org_name text, org_slug text,
               chapters int, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.tagline, c.icon, c.accent, c.thumbnail, c.categories, c.teacher_id,
    c.org_id, g.name, g.slug,
    case when jsonb_typeof(c.chapters) = 'array' then jsonb_array_length(c.chapters) else 0 end,
    c.updated_at
  from public.lexa_tcourses c
  join public.lexa_orgs g on g.id = c.org_id
  where c.visibility = 'org' and c.allow_preview and c.status <> 'draft'
    and g.status = 'active' and (g.expires_at is null or g.expires_at > now())
    and (o is null or c.org_id = o)
  order by c.updated_at desc
  limit greatest(1, least(coalesce(lim, 60), 200))
$$;

-- --- private bucket for centre media: <org_id>/<user_id>/<file> ---
insert into storage.buckets (id, name, public, file_size_limit)
values ('lexa-org-media', 'lexa-org-media', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create or replace function public.lexa_try_uuid(v text)
returns uuid language plpgsql immutable as $$
begin
  return v::uuid;
exception when others then
  return null;
end $$;

drop policy if exists "lexa org media read" on storage.objects;
drop policy if exists "lexa org media insert" on storage.objects;
drop policy if exists "lexa org media delete" on storage.objects;
create policy "lexa org media read" on storage.objects for select to authenticated using (
  bucket_id = 'lexa-org-media' and (
    public.lexa_is_admin()
    or public.lexa_org_active_member(public.lexa_try_uuid((storage.foldername(name))[1]))
    or public.lexa_org_official(public.lexa_try_uuid((storage.foldername(name))[1]))
  )
);
create policy "lexa org media insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'lexa-org-media'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.lexa_org_active(public.lexa_try_uuid((storage.foldername(name))[1]))
  and public.lexa_org_active_member(public.lexa_try_uuid((storage.foldername(name))[1]))
);
create policy "lexa org media delete" on storage.objects for delete to authenticated using (
  bucket_id = 'lexa-org-media' and (
    (storage.foldername(name))[2] = auth.uid()::text
    or public.lexa_org_can_manage(public.lexa_try_uuid((storage.foldername(name))[1]))
  )
);

-- --- grants (002 granted every function to anon; be explicit) ---
revoke execute on function public.lexa_visibility_guard() from public, anon, authenticated;
revoke execute on function public.lexa_ratings_guard() from public, anon, authenticated;
grant execute on function public.lexa_org_active_member(uuid) to anon, authenticated;
grant execute on function public.lexa_can_see(text, uuid, uuid) to anon, authenticated;
grant execute on function public.lexa_try_uuid(text) to anon, authenticated;
grant execute on function public.lexa_rating_aggs(text, uuid[]) to anon, authenticated;
grant execute on function public.lexa_course_students(uuid[]) to anon, authenticated;
grant execute on function public.lexa_org_course_previews(uuid, integer) to anon, authenticated;

notify pgrst, 'reload schema';
