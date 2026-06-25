-- MIGRASI FITUR KUOTA PER HARI
-- Jalankan sekali di Supabase SQL Editor untuk database yang sudah ada.

alter table public.tasks add column if not exists quota_per_day integer;
update public.tasks set quota_per_day = coalesce(quota_per_day, quota, 1);
alter table public.tasks alter column quota_per_day set default 1;
alter table public.tasks alter column quota_per_day set not null;

alter table public.task_claims add column if not exists work_date date default ((now() at time zone 'Asia/Jakarta')::date);
update public.task_claims set work_date = (claimed_at at time zone 'Asia/Jakarta')::date where work_date is null;
alter table public.task_claims alter column work_date set not null;
alter table public.task_claims drop constraint if exists task_claims_task_id_worker_id_key;
alter table public.task_claims add constraint task_claims_task_id_worker_id_work_date_key unique (task_id, worker_id, work_date);

alter table public.submissions add column if not exists work_date date default ((now() at time zone 'Asia/Jakarta')::date);
update public.submissions set work_date = (submitted_at at time zone 'Asia/Jakarta')::date where work_date is null;
alter table public.submissions alter column work_date set not null;

create or replace function public.enforce_daily_task_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  daily_limit integer;
  used_count integer;
begin
  select quota_per_day into daily_limit
  from public.tasks
  where id = new.task_id;

  select count(*) into used_count
  from public.submissions
  where task_id = new.task_id
    and work_date = coalesce(new.work_date, (now() at time zone 'Asia/Jakarta')::date);

  if used_count >= coalesce(daily_limit, 1) then
    raise exception 'Kuota task hari ini sudah penuh. Besok akan aktif lagi.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_daily_task_quota on public.submissions;
create trigger trg_enforce_daily_task_quota
before insert on public.submissions
for each row execute function public.enforce_daily_task_quota();
