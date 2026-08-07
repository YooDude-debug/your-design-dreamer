create or replace function public.is_arena_challenge_visible(_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.arena_challenges c
    where c.id = _challenge_id
      and (c.status <> 'draft'::arena_challenge_status
           or c.company_id = auth.uid()
           or public.has_role(auth.uid(), 'admin'::app_role))
  )
$$;

revoke execute on function public.is_arena_challenge_visible(uuid) from anon;

create or replace function public.can_see_arena_submission(_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.arena_submissions s
    join public.arena_challenges c on c.id = s.challenge_id
    where s.id = _submission_id
      and (c.status <> 'draft'::arena_challenge_status
           or c.company_id = auth.uid()
           or s.creator_id = auth.uid()
           or public.has_role(auth.uid(), 'admin'::app_role))
  )
$$;

revoke execute on function public.can_see_arena_submission(uuid) from anon;

drop policy if exists arena_submissions_select on public.arena_submissions;
create policy arena_submissions_select on public.arena_submissions
for select to authenticated
using (
  creator_id = auth.uid()
  or public.has_role(auth.uid(), 'admin'::app_role)
  or public.is_arena_challenge_visible(challenge_id)
);

drop policy if exists arena_comments_select on public.arena_comments;
create policy arena_comments_select on public.arena_comments
for select to authenticated
using (
  user_id = auth.uid()
  or public.has_role(auth.uid(), 'admin'::app_role)
  or public.can_see_arena_submission(submission_id)
);