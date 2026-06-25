-- Jalankan jika ada submission approved lama tetapi belum muncul di menu Pembayaran.
insert into public.payments (submission_id, worker_id, amount, status)
select s.id, s.worker_id, coalesce(t.reward_amount, 0), 'unpaid'
from public.submissions s
left join public.tasks t on t.id = s.task_id
left join public.payments p on p.submission_id = s.id
where s.status = 'approved'
  and p.id is null;
