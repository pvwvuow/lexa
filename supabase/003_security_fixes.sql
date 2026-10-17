-- Lexa 003: security hardening for the already-live 002 migration.
-- Run once in the Supabase SQL editor after 002. Safe to re-run: no data is
-- deleted or rewritten.
--   * internal helpers (promote/guards/role) are no longer callable as /rpc
--   * signed-in-only RPCs are no longer callable by anon
--   * org seat limits are enforced on join requests and approvals
--   * ratings must point at a real, visible post/course
--   * rating/student aggregates hide draft courses and cap array size

-- Keep RLS enabled even if a deployment restored a table without its policy flag.
alter table public.lexa_state enable row level security;
alter table public.lexa_profiles enable row level security;
alter table public.lexa_orgs enable row level security;
alter table public.lexa_org_members enable row level security;
alter table public.lexa_org_private enable row level security;
alter table public.lexa_teacher_requests enable row level security;
alter table public.lexa_posts enable row level security;
alter table public.lexa_comments enable row level security;
alter table public.lexa_follows enable row level security;
alter table public.lexa_tcourses enable row level security;
alter table public.lexa_library enable row level security;
alter table public.lexa_ratings enable row level security;

-- These tables intentionally have no direct client write path. Their SECURITY
-- DEFINER RPCs remain able to write them as the function owner.
revoke insert, update, delete on public.lexa_org_members from public, anon, authenticated;
-- lexa_org_private keeps UPDATE for authenticated: org settings save the contact
-- through RLS (managers only) + lexa_org_private_guard.
revoke insert, delete on public.lexa_org_private from public, anon, authenticated;
revoke update on public.lexa_org_private from public, anon;
revoke insert, update, delete on public.lexa_teacher_requests from public, anon, authenticated;

-- The original all-functions grant exposed internal promotion/guard functions
-- as /rpc endpoints. Keep only the RPCs that the client actually needs.
revoke execute on function public.lexa_default_username(uuid) from public, anon, authenticated;
revoke execute on function public.lexa_role() from public, anon, authenticated;
revoke execute on function public.lexa_profiles_guard() from public, anon, authenticated;
revoke execute on function public.lexa_touch_updated() from public, anon, authenticated;
revoke execute on function public.lexa_orgs_guard() from public, anon, authenticated;
revoke execute on function public.lexa_org_private_guard() from public, anon, authenticated;
revoke execute on function public.lexa_posts_guard() from public, anon, authenticated;
revoke execute on function public.lexa_comments_guard() from public, anon, authenticated;
revoke execute on function public.lexa_tcourses_guard() from public, anon, authenticated;
revoke execute on function public.lexa_drop_ratings() from public, anon, authenticated;
revoke execute on function public.lexa_promote_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.lexa_is_teacher() from public, anon;
revoke execute on function public.lexa_org_can_publish(uuid) from public, anon;
revoke execute on function public.lexa_find_user(text) from public, anon;
revoke execute on function public.lexa_set_username(text) from public, anon;
revoke execute on function public.lexa_request_teacher(text, text, text, text) from public, anon;
revoke execute on function public.lexa_admin_review_teacher(uuid, boolean, text) from public, anon;
revoke execute on function public.lexa_admin_set_role(uuid, text) from public, anon;
revoke execute on function public.lexa_admin_set_org(uuid, text, text, integer, timestamptz, text) from public, anon;
revoke execute on function public.lexa_create_org(text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.lexa_org_seats_used(uuid) from public, anon;
revoke execute on function public.lexa_org_invite(uuid, uuid, text, text) from public, anon;
revoke execute on function public.lexa_org_request(uuid, text) from public, anon;
revoke execute on function public.lexa_org_respond(uuid, boolean) from public, anon;
revoke execute on function public.lexa_org_review(uuid, uuid, boolean) from public, anon;
revoke execute on function public.lexa_org_set_member(uuid, uuid, text, text, boolean) from public, anon;
revoke execute on function public.lexa_org_unlink(uuid, text, uuid) from public, anon;

grant execute on function public.lexa_is_teacher() to authenticated;
grant execute on function public.lexa_org_can_publish(uuid) to authenticated;
grant execute on function public.lexa_find_user(text) to authenticated;
grant execute on function public.lexa_set_username(text) to authenticated;
grant execute on function public.lexa_request_teacher(text, text, text, text) to authenticated;
grant execute on function public.lexa_admin_review_teacher(uuid, boolean, text) to authenticated;
grant execute on function public.lexa_admin_set_role(uuid, text) to authenticated;
grant execute on function public.lexa_admin_set_org(uuid, text, text, integer, timestamptz, text) to authenticated;
grant execute on function public.lexa_create_org(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.lexa_org_seats_used(uuid) to authenticated;
grant execute on function public.lexa_org_invite(uuid, uuid, text, text) to authenticated;
grant execute on function public.lexa_org_request(uuid, text) to authenticated;
grant execute on function public.lexa_org_respond(uuid, boolean) to authenticated;
grant execute on function public.lexa_org_review(uuid, uuid, boolean) to authenticated;
grant execute on function public.lexa_org_set_member(uuid, uuid, text, text, boolean) to authenticated;
grant execute on function public.lexa_org_unlink(uuid, text, uuid) to authenticated;

-- These helpers are referenced by anonymous SELECT policies, so anonymous
-- EXECUTE is required for public org/member listings to keep working.
grant execute on function public.lexa_is_admin() to anon, authenticated;
grant execute on function public.lexa_org_active(uuid) to anon, authenticated;
grant execute on function public.lexa_org_can_manage(uuid) to anon, authenticated;
grant execute on function public.lexa_org_is_member(uuid) to anon, authenticated;
grant execute on function public.lexa_rating_aggs(text, uuid[]) to anon, authenticated;
grant execute on function public.lexa_course_students(uuid[]) to anon, authenticated;
grant execute on function public.lexa_teacher_stats(uuid[]) to anon, authenticated;
grant execute on function public.lexa_teacher_directory(text, integer) to anon, authenticated;

-- A teacher could otherwise create unlimited requested rows while an org is
-- full; accepting one also must not exceed the admin-configured seat count.
create or replace function public.lexa_org_request(o uuid, m_message text default '')
returns text language plpgsql security definer set search_path = public as $$
declare cur record;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.lexa_is_teacher() then raise exception 'teacher accounts only'; end if;
  if not public.lexa_org_active(o) then raise exception 'organisation panel is not active'; end if;
  select * into cur from public.lexa_org_members where org_id = o and user_id = auth.uid();
  if cur.user_id is not null and cur.status = 'active' then return 'active'; end if;
  if cur.user_id is not null and cur.status = 'invited' then
    update public.lexa_org_members set status = 'active' where org_id = o and user_id = auth.uid();
    return 'active';
  end if;
  if (cur.user_id is null or cur.status in ('declined', 'removed'))
     and public.lexa_org_seats_used(o) >= (select seats from public.lexa_orgs where id = o) then
    raise exception 'no free seats';
  end if;
  insert into public.lexa_org_members (org_id, user_id, role, status, message)
  values (o, auth.uid(), 'teacher', 'requested', left(coalesce(m_message, ''), 300))
  on conflict (org_id, user_id) do update set status = 'requested', message = excluded.message;
  return 'requested';
end $$;

create or replace function public.lexa_org_review(o uuid, uid uuid, accept boolean)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.lexa_org_can_manage(o) then raise exception 'not a manager of this organisation'; end if;
  if not public.lexa_org_active(o) then raise exception 'organisation panel is not active'; end if;
  if accept and public.lexa_org_seats_used(o) >
       (select seats from public.lexa_orgs where id = o) then
    raise exception 'no free seats';
  end if;
  update public.lexa_org_members set status = case when accept then 'active' else 'declined' end
  where org_id = o and user_id = uid and status = 'requested';
  if not found then raise exception 'no pending request'; end if;
  return case when accept then 'active' else 'declined' end;
end $$;

-- Ratings are polymorphic, so the original table had no FK. Validate every
-- insert/update and do not permit ratings on another user's hidden draft.
create or replace function public.lexa_ratings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'post' then
    if not exists (select 1 from public.lexa_posts p where p.id = new.target_id) then
      raise exception 'rating target not found';
    end if;
  elsif new.target_type = 'tcourse' then
    if not exists (
      select 1 from public.lexa_tcourses c
      where c.id = new.target_id
        and (c.status <> 'draft' or c.teacher_id = auth.uid() or public.lexa_is_admin())
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
drop trigger if exists lexa_ratings_guard on public.lexa_ratings;
create trigger lexa_ratings_guard before insert or update on public.lexa_ratings
  for each row execute function public.lexa_ratings_guard();
revoke execute on function public.lexa_ratings_guard() from public, anon, authenticated;

-- Aggregate RPCs must not disclose metrics for hidden drafts, accept arbitrary
-- target types, or consume unbounded arrays from the public endpoint.
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
      and (t = 'post' or exists (
        select 1 from public.lexa_tcourses c
        where c.id = r.target_id
          and (c.status <> 'draft' or c.teacher_id = auth.uid() or public.lexa_is_admin())
      ))
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
      and (c.status <> 'draft' or c.teacher_id = auth.uid() or public.lexa_is_admin())
    group by l.course_id;
end $$;

-- Be explicit about Storage UPDATE's destination check (Postgres normally
-- defaults it to USING, but keeping it explicit prevents future policy drift).
drop policy if exists "lexa media update own" on storage.objects;
create policy "lexa media update own" on storage.objects for update to authenticated
  using (bucket_id = 'lexa-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'lexa-media' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
