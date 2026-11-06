-- Evenly database schema.
-- Paste this whole file into Supabase: SQL Editor > New query > Run.
-- It is safe to run again: it drops and recreates the functions and policies,
-- but it never deletes your data tables.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- A person. Can exist before they sign up (added by a friend via email);
-- when they sign up with that email the profile gets linked to their account.
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email text not null unique,
  name text not null,
  default_currency text not null default 'AED',
  created_at timestamptz not null default now()
);

create table if not exists public.friendships (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, friend_id),
  check (profile_id <> friend_id)
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'other',
  currency text not null default 'AED',
  simplify_debts boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete cascade,
  description text not null,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null,
  category text not null default 'general',
  split_type text not null default 'equal',
  is_payment boolean not null default false,
  date date not null default current_date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who paid how much and who owes how much for each expense.
-- For every expense: sum(paid) = sum(owed) = amount.
create table if not exists public.expense_shares (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  paid numeric(14, 2) not null default 0 check (paid >= 0),
  owed numeric(14, 2) not null default 0 check (owed >= 0),
  primary key (expense_id, profile_id)
);

create table if not exists public.activity (
  id bigserial primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null,
  group_id uuid,
  group_name text,
  expense_id uuid,
  description text,
  amount numeric(14, 2),
  currency text,
  involved uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists expense_shares_profile_idx on public.expense_shares (profile_id);
create index if not exists expenses_group_idx on public.expenses (group_id);
create index if not exists group_members_profile_idx on public.group_members (profile_id);
create index if not exists activity_involved_idx on public.activity using gin (involved);
create index if not exists activity_group_idx on public.activity (group_id);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies do not recurse)
-- ---------------------------------------------------------------------------

create or replace function public.me() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where user_id = auth.uid()
$$;

create or replace function public.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group and profile_id = public.me()
  )
$$;

create or replace function public.can_see_expense(p_expense uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.expenses e
    where e.id = p_expense
      and (
        (e.group_id is not null and public.is_group_member(e.group_id))
        or exists (
          select 1 from public.expense_shares s
          where s.expense_id = e.id and s.profile_id = public.me()
        )
      )
  )
$$;

-- People I am allowed to see: me, my friends, people in my groups,
-- people who share an expense with me.
create or replace function public.can_see_profile(p_profile uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_profile = public.me()
    or exists (select 1 from public.friendships f where f.profile_id = public.me() and f.friend_id = p_profile)
    or exists (select 1 from public.friendships f where f.friend_id = public.me() and f.profile_id = p_profile)
    or exists (
      select 1 from public.group_members a
      join public.group_members b on a.group_id = b.group_id
      where a.profile_id = public.me() and b.profile_id = p_profile
    )
    or exists (
      select 1 from public.expense_shares a
      join public.expense_shares b on a.expense_id = b.expense_id
      where a.profile_id = public.me() and b.profile_id = p_profile
    )
$$;

create or replace function public.require_me() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  v := public.me();
  if v is null then
    raise exception 'Not signed in';
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security: everyone reads only what concerns them.
-- All writes go through the functions below.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.activity enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.can_see_profile(id));

drop policy if exists friendships_read on public.friendships;
create policy friendships_read on public.friendships for select to authenticated
  using (profile_id = public.me());

drop policy if exists groups_read on public.groups;
create policy groups_read on public.groups for select to authenticated
  using (public.is_group_member(id));

drop policy if exists group_members_read on public.group_members;
create policy group_members_read on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists expenses_read on public.expenses;
create policy expenses_read on public.expenses for select to authenticated
  using (public.can_see_expense(id));

drop policy if exists expense_shares_read on public.expense_shares;
create policy expense_shares_read on public.expense_shares for select to authenticated
  using (public.can_see_expense(expense_id));

drop policy if exists activity_read on public.activity;
create policy activity_read on public.activity for select to authenticated
  using (
    public.me() = any (involved)
    or (group_id is not null and public.is_group_member(group_id))
  );

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Write functions (RPCs) called by the app
-- ---------------------------------------------------------------------------

-- Called after every sign in. Creates my profile, or links the profile a
-- friend already created for my email address.
create or replace function public.ensure_profile(p_name text default null)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_profile public.profiles;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into v_profile from public.profiles where user_id = auth.uid();
  if found then
    return v_profile;
  end if;

  select lower(email) into v_email from auth.users where id = auth.uid();
  v_name := coalesce(nullif(trim(p_name), ''), split_part(v_email, '@', 1));

  select * into v_profile from public.profiles where email = v_email;
  if found then
    update public.profiles
      set user_id = auth.uid(),
          name = case when nullif(trim(p_name), '') is not null then trim(p_name) else name end
      where id = v_profile.id
      returning * into v_profile;
  else
    insert into public.profiles (user_id, email, name)
      values (auth.uid(), v_email, v_name)
      returning * into v_profile;
  end if;
  return v_profile;
end $$;

create or replace function public.update_my_profile(p_name text, p_default_currency text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if nullif(trim(p_name), '') is null then
    raise exception 'Name cannot be empty';
  end if;
  update public.profiles
    set name = trim(p_name), default_currency = upper(p_default_currency)
    where id = public.require_me();
end $$;

-- Find (or create a placeholder for) a person by email and make them my friend.
create or replace function public.add_friend(p_email text, p_name text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_me();
  v_email text := lower(trim(p_email));
  v_id uuid;
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address';
  end if;

  select id into v_id from public.profiles where email = v_email;
  if v_id is null then
    insert into public.profiles (email, name)
      values (v_email, coalesce(nullif(trim(p_name), ''), split_part(v_email, '@', 1)))
      returning id into v_id;
  end if;

  if v_id = v_me then
    raise exception 'That is you!';
  end if;

  insert into public.friendships (profile_id, friend_id) values (v_me, v_id) on conflict do nothing;
  insert into public.friendships (profile_id, friend_id) values (v_id, v_me) on conflict do nothing;

  insert into public.activity (actor_id, kind, involved, description)
    values (v_me, 'friend_added', array[v_me, v_id], null);
  return v_id;
end $$;

create or replace function public.remove_friend(p_friend uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.require_me();
begin
  delete from public.friendships
    where (profile_id = v_me and friend_id = p_friend)
       or (profile_id = p_friend and friend_id = v_me);
end $$;

create or replace function public.create_group(
  p_name text, p_currency text, p_kind text, p_member_ids uuid[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_me();
  v_id uuid;
  v_member uuid;
begin
  if nullif(trim(p_name), '') is null then
    raise exception 'Group name cannot be empty';
  end if;
  insert into public.groups (name, currency, kind, created_by)
    values (trim(p_name), upper(p_currency), coalesce(p_kind, 'other'), v_me)
    returning id into v_id;

  insert into public.group_members (group_id, profile_id) values (v_id, v_me);
  foreach v_member in array coalesce(p_member_ids, '{}') loop
    if v_member <> v_me then
      perform 1 from public.profiles where id = v_member;
      if found and public.can_see_profile(v_member) then
        insert into public.group_members (group_id, profile_id) values (v_id, v_member)
          on conflict do nothing;
      end if;
    end if;
  end loop;

  insert into public.activity (actor_id, kind, group_id, group_name, involved)
    select v_me, 'group_created', v_id, trim(p_name), array_agg(profile_id)
    from public.group_members where group_id = v_id;
  return v_id;
end $$;

create or replace function public.update_group(
  p_group uuid, p_name text, p_currency text, p_kind text, p_simplify boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_me();
  if not public.is_group_member(p_group) then
    raise exception 'You are not in this group';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'Group name cannot be empty';
  end if;
  update public.groups
    set name = trim(p_name), currency = upper(p_currency),
        kind = coalesce(p_kind, kind), simplify_debts = coalesce(p_simplify, simplify_debts)
    where id = p_group;
end $$;

create or replace function public.add_group_member(p_group uuid, p_profile uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_me();
  v_group_name text;
begin
  if not public.is_group_member(p_group) then
    raise exception 'You are not in this group';
  end if;
  if not public.can_see_profile(p_profile) then
    raise exception 'Add this person as a friend first';
  end if;
  insert into public.group_members (group_id, profile_id) values (p_group, p_profile)
    on conflict do nothing;
  select name into v_group_name from public.groups where id = p_group;
  insert into public.activity (actor_id, kind, group_id, group_name, involved)
    values (v_me, 'member_added', p_group, v_group_name, array[v_me, p_profile]);
end $$;

create or replace function public.remove_group_member(p_group uuid, p_profile uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_me();
  v_balance numeric;
begin
  if not public.is_group_member(p_group) then
    raise exception 'You are not in this group';
  end if;
  select coalesce(sum(s.paid - s.owed), 0) into v_balance
    from public.expense_shares s
    join public.expenses e on e.id = s.expense_id
    where e.group_id = p_group and s.profile_id = p_profile
    group by e.currency
    having sum(s.paid - s.owed) <> 0
    limit 1;
  if coalesce(v_balance, 0) <> 0 then
    raise exception 'This person still has an unsettled balance in the group';
  end if;
  delete from public.group_members where group_id = p_group and profile_id = p_profile;
end $$;

create or replace function public.delete_group(p_group uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_me();
  v_name text;
  v_involved uuid[];
begin
  if not public.is_group_member(p_group) then
    raise exception 'You are not in this group';
  end if;
  select name into v_name from public.groups where id = p_group;
  select array_agg(profile_id) into v_involved from public.group_members where group_id = p_group;
  delete from public.groups where id = p_group;
  insert into public.activity (actor_id, kind, group_name, involved)
    values (v_me, 'group_deleted', v_name, v_involved);
end $$;

-- Create or update an expense (or a payment) with its shares, atomically.
-- p_shares: [{"profile_id": "...", "paid": 12.5, "owed": 6.25}, ...]
create or replace function public.save_expense(
  p_id uuid,
  p_group uuid,
  p_description text,
  p_amount numeric,
  p_currency text,
  p_category text,
  p_split_type text,
  p_is_payment boolean,
  p_date date,
  p_notes text,
  p_shares jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_me();
  v_id uuid := p_id;
  v_paid numeric;
  v_owed numeric;
  v_count int;
  v_involved uuid[];
  v_group_name text;
  v_share jsonb;
  v_pid uuid;
  v_old_group uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be more than zero';
  end if;
  if nullif(trim(p_description), '') is null then
    raise exception 'Please add a description';
  end if;
  if jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) = 0 then
    raise exception 'Nobody is part of this expense';
  end if;

  select coalesce(sum((s->>'paid')::numeric), 0), coalesce(sum((s->>'owed')::numeric), 0), count(*)
    into v_paid, v_owed, v_count
    from jsonb_array_elements(p_shares) s;

  if abs(v_paid - p_amount) > 0.001 then
    raise exception 'The amounts paid (%) do not add up to the total (%)', v_paid, p_amount;
  end if;
  if abs(v_owed - p_amount) > 0.001 then
    raise exception 'The split amounts (%) do not add up to the total (%)', v_owed, p_amount;
  end if;

  select array_agg(distinct (s->>'profile_id')::uuid) into v_involved
    from jsonb_array_elements(p_shares) s;
  if array_length(v_involved, 1) <> v_count then
    raise exception 'A person appears twice in this expense';
  end if;
  if array_length(v_involved, 1) < 2 then
    raise exception 'An expense needs at least two people';
  end if;

  if p_group is not null then
    if not public.is_group_member(p_group) then
      raise exception 'You are not in this group';
    end if;
    if exists (
      select 1 from unnest(v_involved) pid
      where not exists (select 1 from public.group_members m where m.group_id = p_group and m.profile_id = pid)
    ) then
      raise exception 'Everyone in the expense must be in the group';
    end if;
    select name into v_group_name from public.groups where id = p_group;
  else
    if not (v_me = any (v_involved)) then
      raise exception 'You must be part of an expense outside a group';
    end if;
    foreach v_pid in array v_involved loop
      if not public.can_see_profile(v_pid) then
        raise exception 'Add everyone as a friend first';
      end if;
    end loop;
  end if;

  if v_id is not null then
    if not public.can_see_expense(v_id) then
      raise exception 'Expense not found';
    end if;
    select group_id into v_old_group from public.expenses where id = v_id;
    update public.expenses set
      group_id = p_group, description = trim(p_description), amount = p_amount,
      currency = upper(p_currency), category = coalesce(p_category, 'general'),
      split_type = coalesce(p_split_type, 'equal'), is_payment = coalesce(p_is_payment, false),
      date = coalesce(p_date, current_date), notes = nullif(trim(p_notes), ''),
      updated_by = v_me, updated_at = now()
    where id = v_id;
    delete from public.expense_shares where expense_id = v_id;
  else
    insert into public.expenses (group_id, description, amount, currency, category, split_type,
                                 is_payment, date, notes, created_by, updated_by)
      values (p_group, trim(p_description), p_amount, upper(p_currency), coalesce(p_category, 'general'),
              coalesce(p_split_type, 'equal'), coalesce(p_is_payment, false), coalesce(p_date, current_date),
              nullif(trim(p_notes), ''), v_me, v_me)
      returning id into v_id;
  end if;

  for v_share in select * from jsonb_array_elements(p_shares) loop
    insert into public.expense_shares (expense_id, profile_id, paid, owed)
      values (v_id, (v_share->>'profile_id')::uuid,
              round(coalesce((v_share->>'paid')::numeric, 0), 2),
              round(coalesce((v_share->>'owed')::numeric, 0), 2));
  end loop;

  -- Non group expenses make people friends automatically, like Splitwise.
  if p_group is null then
    foreach v_pid in array v_involved loop
      if v_pid <> v_me then
        insert into public.friendships (profile_id, friend_id) values (v_me, v_pid) on conflict do nothing;
        insert into public.friendships (profile_id, friend_id) values (v_pid, v_me) on conflict do nothing;
      end if;
    end loop;
  end if;

  insert into public.activity (actor_id, kind, group_id, group_name, expense_id, description, amount, currency, involved)
    values (
      v_me,
      case when p_id is null then (case when p_is_payment then 'payment_added' else 'expense_added' end)
           else (case when p_is_payment then 'payment_updated' else 'expense_updated' end) end,
      p_group, v_group_name, v_id, trim(p_description), p_amount, upper(p_currency),
      v_involved || v_me
    );
  return v_id;
end $$;

create or replace function public.delete_expense(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.require_me();
  v_exp public.expenses;
  v_involved uuid[];
  v_group_name text;
begin
  if not public.can_see_expense(p_id) then
    raise exception 'Expense not found';
  end if;
  select * into v_exp from public.expenses where id = p_id;
  select array_agg(profile_id) into v_involved from public.expense_shares where expense_id = p_id;
  select name into v_group_name from public.groups where id = v_exp.group_id;
  delete from public.expenses where id = p_id;
  insert into public.activity (actor_id, kind, group_id, group_name, description, amount, currency, involved)
    values (v_me, case when v_exp.is_payment then 'payment_deleted' else 'expense_deleted' end,
            v_exp.group_id, v_group_name, v_exp.description, v_exp.amount, v_exp.currency,
            coalesce(v_involved, '{}') || v_me);
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Live updates: the app refreshes when any of these change.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['profiles', 'friendships', 'groups', 'group_members', 'expenses', 'expense_shares', 'activity'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
