// =========================
// KONFIGURASI SUPABASE
// Ganti dua nilai ini sesuai project Supabase Anda.
// =========================
const SUPABASE_URL = 'https://lxtwlnqvblavllesgitt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4dHdsbnF2YmxhdmxsZXNnaXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNTg2NzAsImV4cCI6MjA5NzkzNDY3MH0.QY5jCi7QChIvhPBxzg_7h0Ek8yW8c5tLY0D9pHD_IOc';


const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let session = null;
let me = null;
let currentPage = 'dashboard';

const $ = (id) => document.getElementById(id);
const money = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n || 0));
const date = (d) => d ? new Date(d).toLocaleString('id-ID') : '-';
const statusBadge = (s) => {
  const cls = ['approved','paid','active'].includes(s) ? 'ok' : ['submitted','unpaid','in_progress'].includes(s) ? 'warn' : ['rejected','inactive','closed'].includes(s) ? 'danger' : 'info';
  return `<span class="badge ${cls}">${s || '-'}</span>`;
};
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone:'Asia/Jakarta' });
const tomorrowKey = () => { const d = new Date(); d.setDate(d.getDate()+1); return d.toLocaleDateString('en-CA', { timeZone:'Asia/Jakarta' }); };
const quotaPerDay = (t) => Number(t?.quota_per_day ?? t?.quota ?? 1);

async function getTodaySubmissionCounts(taskIds=[]) {
  if (!taskIds.length) return {};
  const { data, error } = await sb.from('submissions')
    .select('task_id')
    .in('task_id', taskIds)
    .eq('work_date', todayKey());
  if (error) { toast(error.message); return {}; }
  return (data || []).reduce((acc, row) => { acc[row.task_id] = (acc[row.task_id] || 0) + 1; return acc; }, {});
}

function toast(msg) {
  const box = document.createElement('div');
  box.className = 'toast';
  box.textContent = msg;
  $('toast').appendChild(box);
  setTimeout(() => box.remove(), 3500);
}

async function init() {
  const { data } = await sb.auth.getSession();
  session = data.session;
  if (session) await loadProfile();
  else showLogin();

  $('btnLogin').onclick = login;
  $('btnLogout').onclick = logout;
}

async function login() {
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value.trim();
  if (!email || !password) return toast('Email dan password wajib diisi.');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return toast(error.message);
  session = data.session;
  await loadProfile();
}

async function logout() {
  await sb.auth.signOut();
  session = null;
  me = null;
  showLogin();
}

async function loadProfile() {
  const { data, error } = await sb.from('profiles').select('*').eq('auth_user_id', session.user.id).single();
  if (error || !data) {
    toast('Profile tidak ditemukan. Pastikan user sudah dibuat di tabel profiles.');
    return showLogin();
  }
  if (data.status !== 'active') {
    toast('Akun Anda nonaktif.');
    await logout();
    return;
  }
  me = data;
  showApp();
}

function showLogin() {
  $('loginPage').classList.remove('hidden');
  $('appPage').classList.add('hidden');
}

function showApp() {
  $('loginPage').classList.add('hidden');
  $('appPage').classList.remove('hidden');
  $('userBox').innerHTML = `<b>${me.nama}</b><br>${me.email || ''}<br>Role: ${me.role}`;
  renderMenu();
  go('dashboard');
}

function renderMenu() {
  const adminMenus = [
    ['dashboard','Dashboard'], ['tasks','Kelola Task'], ['submissions','Submit Masuk'],
    ['payments','Pembayaran'], ['workers','Data Worker'], ['reports','Laporan']
  ];
  const workerMenus = [
    ['dashboard','Dashboard'], ['available','Task Tersedia'], ['mytasks','Task Saya'],
    ['payhistory','Riwayat Pembayaran'], ['profile','Profil']
  ];
  const menus = me.role === 'admin' ? adminMenus : workerMenus;
  $('menu').innerHTML = menus.map(([key,label]) => `<button data-page="${key}">${label}</button>`).join('');
  document.querySelectorAll('#menu button').forEach(btn => btn.onclick = () => go(btn.dataset.page));
}

async function go(page) {
  currentPage = page;
  document.querySelectorAll('#menu button').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  const titles = { dashboard:'Dashboard', tasks:'Kelola Task', submissions:'Submit Masuk', payments:'Pembayaran', workers:'Data Worker', reports:'Laporan', available:'Task Tersedia', mytasks:'Task Saya', payhistory:'Riwayat Pembayaran', profile:'Profil' };
  $('pageTitle').textContent = titles[page] || 'Dashboard';
  if (me.role === 'admin') {
    if (page === 'dashboard') return adminDashboard();
    if (page === 'tasks') return adminTasks();
    if (page === 'submissions') return adminSubmissions();
    if (page === 'payments') return adminPayments();
    if (page === 'workers') return adminWorkers();
    if (page === 'reports') return adminReports();
  } else {
    if (page === 'dashboard') return workerDashboard();
    if (page === 'available') return workerAvailableTasks();
    if (page === 'mytasks') return workerMyTasks();
    if (page === 'payhistory') return workerPayments();
    if (page === 'profile') return workerProfile();
  }
}

function setContent(html) { $('content').innerHTML = html; }

async function adminDashboard() {
  const [tasks, workers, subs, pays] = await Promise.all([
    sb.from('tasks').select('id,status'),
    sb.from('profiles').select('id,role,status').eq('role','worker'),
    sb.from('submissions').select('id,status'),
    sb.from('payments').select('amount,status')
  ]);
  const totalUnpaid = (pays.data||[]).filter(p=>p.status==='unpaid').reduce((a,b)=>a+Number(b.amount||0),0);
  const totalPaid = (pays.data||[]).filter(p=>p.status==='paid').reduce((a,b)=>a+Number(b.amount||0),0);
  setContent(`<div class="grid">
    ${stat('Task Aktif',(tasks.data||[]).filter(x=>x.status==='active').length)}
    ${stat('Worker Aktif',(workers.data||[]).filter(x=>x.status==='active').length)}
    ${stat('Menunggu Review',(subs.data||[]).filter(x=>x.status==='submitted').length)}
    ${stat('Approved',(subs.data||[]).filter(x=>x.status==='approved').length)}
    ${stat('Belum Dibayar',money(totalUnpaid))}
    ${stat('Sudah Dibayar',money(totalPaid))}
  </div>`);
}

function stat(label, value) { return `<div class="stat"><span>${label}</span><b>${value}</b></div>`; }

async function adminTasks() {
  const { data } = await sb.from('tasks').select('*').order('created_at', { ascending:false });
  const todayCounts = await getTodaySubmissionCounts((data || []).map(t => t.id));
  setContent(`<div class="card">
    <h3>Tambah Task</h3>
    <div class="form-grid">
      <div><label>Judul Task</label><input id="taskTitle"></div>
      <div><label>Link Target</label><input id="taskLink"></div>
      <div><label>Bayaran</label><input id="taskReward" type="number" value="2000"></div>
      <div><label>Kuota Per Hari</label><input id="taskQuotaPerDay" type="number" value="1"></div>
      <div><label>Deadline</label><input id="taskDeadline" type="date"></div>
      <div><label>Status</label><select id="taskStatus"><option value="active">active</option><option value="inactive">inactive</option><option value="closed">closed</option></select></div>
      <div class="full"><label>Deskripsi</label><textarea id="taskDesc"></textarea></div>
      <div class="full"><label>Instruksi</label><textarea id="taskInstruction"></textarea></div>
    </div>
    <div class="actions"><button id="btnCreateTask">Simpan Task</button></div>
  </div>
  <div class="card"><h3>Daftar Task</h3>${tasksTable(data||[], todayCounts)}</div>`);
  $('btnCreateTask').onclick = createTask;
  document.querySelectorAll('[data-task-status]').forEach(btn => btn.onclick = () => updateTaskStatus(btn.dataset.taskStatus, btn.dataset.status));
}

function tasksTable(rows, todayCounts={}) {
  if (!rows.length) return '<p class="muted">Belum ada task.</p>';
  return `<table><thead><tr><th>Judul</th><th>Bayaran</th><th>Kuota Hari Ini</th><th>Deadline</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
    ${rows.map(r=>{
      const used = todayCounts[r.id] || 0;
      const limit = quotaPerDay(r);
      const dailyStatus = used >= limit ? '<span class="badge danger">penuh hari ini</span>' : statusBadge(r.status);
      return `<tr><td><b>${r.title}</b><br><span class="muted">${r.target_link||''}</span></td><td>${money(r.reward_amount)}</td><td>${used} / ${limit}</td><td>${r.deadline||'-'}</td><td>${dailyStatus}</td><td class="actions"><button class="ghost" data-task-status="${r.id}" data-status="active">Aktif</button><button class="secondary" data-task-status="${r.id}" data-status="inactive">Nonaktif</button><button class="danger" data-task-status="${r.id}" data-status="closed">Tutup</button></td></tr>`;
    }).join('')}
  </tbody></table>`;
}

async function createTask() {
  const payload = {
    title: $('taskTitle').value.trim(),
    target_link: $('taskLink').value.trim(),
    reward_amount: Number($('taskReward').value || 0),
    quota_per_day: Number($('taskQuotaPerDay').value || 1),
    deadline: $('taskDeadline').value || null,
    status: $('taskStatus').value,
    description: $('taskDesc').value.trim(),
    instruction: $('taskInstruction').value.trim(),
    created_by: me.id,
  };
  if (!payload.title) return toast('Judul task wajib diisi.');
  const { error } = await sb.from('tasks').insert(payload);
  if (error) return toast(error.message);
  toast('Task berhasil dibuat.');
  adminTasks();
}

async function updateTaskStatus(id, status) {
  const { error } = await sb.from('tasks').update({ status, updated_at:new Date().toISOString() }).eq('id', id);
  if (error) return toast(error.message);
  toast('Status task diperbarui.');
  adminTasks();
}

async function adminWorkers() {
  const { data } = await sb.from('profiles').select('*').eq('role','worker').order('created_at',{ascending:false});
  setContent(`<div class="card">
    <h3>Tambah Worker</h3>
    <div class="form-grid">
      <div><label>Nama Worker</label><input id="workerNama"></div>
      <div><label>Email Login</label><input id="workerEmail" type="email"></div>
      <div><label>No HP</label><input id="workerHp"></div>
      <div><label>E-money</label><input id="workerEmoney" placeholder="contoh: DANA/OVO/GoPay 08xxxx"></div>
      <div><label>Password Awal</label><input id="workerPass" type="text" placeholder="minimal 6 karakter"></div>
    </div>
    <div class="actions"><button id="btnCreateWorker">Buat Akun Worker</button></div>
  </div>
  <div class="card"><h3>Daftar Worker</h3>${workersTable(data||[])}</div>`);
  $('btnCreateWorker').onclick = createWorker;
  document.querySelectorAll('[data-worker-toggle]').forEach(btn => btn.onclick = () => toggleWorker(btn.dataset.workerToggle, btn.dataset.status));
  document.querySelectorAll('[data-worker-reset]').forEach(btn => btn.onclick = () => resetWorker(btn.dataset.workerReset));
}

function workersTable(rows) {
  if (!rows.length) return '<p class="muted">Belum ada worker.</p>';
  return `<table><thead><tr><th>Nama</th><th>Email/HP</th><th>E-money</th><th>Status</th><th>Dibuat</th><th>Aksi</th></tr></thead><tbody>
    ${rows.map(w=>`<tr><td><b>${w.nama}</b></td><td>${w.email||'-'}<br>${w.no_hp||'-'}</td><td>${w.e_money||'-'}</td><td>${statusBadge(w.status)}</td><td>${date(w.created_at)}</td><td class="actions"><button class="ghost" data-worker-toggle="${w.id}" data-status="active">Aktif</button><button class="danger" data-worker-toggle="${w.id}" data-status="inactive">Nonaktif</button><button class="secondary" data-worker-reset="${w.auth_user_id}">Reset Password</button></td></tr>`).join('')}
  </tbody></table>`;
}

async function createWorker() {
  const body = {
    nama: $('workerNama').value.trim(), email: $('workerEmail').value.trim(), no_hp: $('workerHp').value.trim(), e_money: $('workerEmoney').value.trim(), password: $('workerPass').value.trim()
  };
  if (!body.nama || !body.email || !body.password) return toast('Nama, email dan password wajib diisi.');
  const res = await fetch('/create-worker', {
    method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}` }, body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) return toast(data.error || 'Gagal membuat worker.');
  toast('Akun worker berhasil dibuat.');
  adminWorkers();
}

async function toggleWorker(id, status) {
  const { error } = await sb.from('profiles').update({ status, updated_at:new Date().toISOString() }).eq('id', id);
  if (error) return toast(error.message);
  toast('Status worker diperbarui.');
  adminWorkers();
}

async function resetWorker(auth_user_id) {
  const password = prompt('Password baru worker, minimal 6 karakter:');
  if (!password) return;
  const res = await fetch('/reset-worker-password', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}` }, body: JSON.stringify({ auth_user_id, password }) });
  const data = await res.json();
  if (!res.ok) return toast(data.error || 'Gagal reset password.');
  toast('Password worker berhasil direset.');
}

async function adminSubmissions() {
  const { data } = await sb.from('submissions').select('*, tasks(title,reward_amount), profiles(nama,email)').order('submitted_at',{ascending:false});
  setContent(`<div class="card"><h3>Submit Masuk</h3>${submissionsTable(data||[])}</div>`);
  document.querySelectorAll('[data-view-sub]').forEach(b => b.onclick = () => viewSubmission(b.dataset.viewSub));
  document.querySelectorAll('[data-approve]').forEach(b => b.onclick = () => reviewSubmission(b.dataset.approve, 'approved'));
  document.querySelectorAll('[data-reject]').forEach(b => b.onclick = () => reviewSubmission(b.dataset.reject, 'rejected'));
  document.querySelectorAll('[data-revision]').forEach(b => b.onclick = () => reviewSubmission(b.dataset.revision, 'revision'));
}

function submissionsTable(rows) {
  if (!rows.length) return '<p class="muted">Belum ada submit.</p>';
  return `<table><thead><tr><th>Tanggal</th><th>Worker</th><th>Task</th><th>Keterangan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
  ${rows.map(s=>`<tr><td>${date(s.submitted_at)}</td><td><b>${s.profiles?.nama||'-'}</b><br>${s.profiles?.email||''}</td><td>${s.tasks?.title||'-'}<br><span class="money">${money(s.tasks?.reward_amount)}</span></td><td>${(s.result_note||'-').slice(0,120)}</td><td>${statusBadge(s.status)}</td><td class="actions"><button class="ghost" data-view-sub="${s.id}">Detail</button><button class="ok" data-approve="${s.id}">Approve</button><button class="warn" data-revision="${s.id}">Revisi</button><button class="danger" data-reject="${s.id}">Reject</button></td></tr>`).join('')}
  </tbody></table>`;
}

async function viewSubmission(id) {
  const { data, error } = await sb.from('submissions').select('*, tasks(title,reward_amount,target_link), profiles(nama,email)').eq('id', id).single();
  if (error) return toast(error.message);
  modal('Detail Submission', `<p><b>Worker:</b> ${data.profiles?.nama||'-'}<br><b>Task:</b> ${data.tasks?.title||'-'}<br><b>Status:</b> ${data.status}</p><p><b>Keterangan:</b><br>${data.result_note||'-'}</p><p><b>Link Bukti:</b> ${data.proof_link ? `<a href="${data.proof_link}" target="_blank">Buka link</a>` : '-'}</p>${data.screenshot_url ? `<img class="proof-img" src="${data.screenshot_url}">` : '<p>Tidak ada screenshot.</p>'}`);
}

async function reviewSubmission(id, status) {
  const admin_note = status === 'approved' ? '' : (prompt('Catatan admin:') || '');
  const { data: sub, error: e1 } = await sb.from('submissions').select('*, tasks(reward_amount)').eq('id', id).single();
  if (e1) return toast(e1.message);
  const { error } = await sb.from('submissions').update({ status, admin_note, reviewed_at:new Date().toISOString(), reviewed_by:me.id }).eq('id', id);
  if (error) return toast(error.message);
  if (status === 'approved') {
    await sb.from('payments').upsert({ submission_id:id, worker_id:sub.worker_id, amount:sub.tasks?.reward_amount || 0, status:'unpaid' }, { onConflict:'submission_id' });
  }
  toast('Submission diperbarui.');
  adminSubmissions();
}

async function adminPayments() {
  const { data } = await sb.from('payments').select('*, submissions(task_id,status,tasks(title)), profiles(nama,email)').order('created_at',{ascending:false});
  setContent(`<div class="card"><h3>Pembayaran</h3>${paymentsTable(data||[], true)}</div>`);
  document.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => markPaid(b.dataset.pay));
}

function paymentsTable(rows, admin=false) {
  if (!rows.length) return '<p class="muted">Belum ada data pembayaran.</p>';
  return `<table><thead><tr><th>Worker</th><th>Task</th><th>Nominal</th><th>Status</th><th>Tanggal Bayar</th>${admin?'<th>Aksi</th>':''}</tr></thead><tbody>
  ${rows.map(p=>`<tr><td>${p.profiles?.nama||'-'}<br>${p.profiles?.email||''}</td><td>${p.submissions?.tasks?.title||'-'}</td><td class="money">${money(p.amount)}</td><td>${statusBadge(p.status)}</td><td>${date(p.paid_at)}</td>${admin?`<td>${p.status==='unpaid'?`<button class="ok" data-pay="${p.id}">Tandai Dibayar</button>`:'-'}</td>`:''}</tr>`).join('')}
  </tbody></table>`;
}

async function markPaid(id) {
  const note = prompt('Catatan pembayaran, boleh dikosongkan:') || '';
  const { error } = await sb.from('payments').update({ status:'paid', paid_at:new Date().toISOString(), paid_by:me.id, payment_note:note }).eq('id', id);
  if (error) return toast(error.message);
  toast('Pembayaran ditandai paid.');
  adminPayments();
}

async function adminReports() {
  const { data: pays } = await sb.from('payments').select('amount,status');
  const { data: subs } = await sb.from('submissions').select('status');
  const unpaid = (pays||[]).filter(p=>p.status==='unpaid').reduce((a,b)=>a+Number(b.amount||0),0);
  const paid = (pays||[]).filter(p=>p.status==='paid').reduce((a,b)=>a+Number(b.amount||0),0);
  setContent(`<div class="grid">
    ${stat('Total Submission',(subs||[]).length)}
    ${stat('Approved',(subs||[]).filter(s=>s.status==='approved').length)}
    ${stat('Ditolak',(subs||[]).filter(s=>s.status==='rejected').length)}
    ${stat('Nominal Belum Dibayar',money(unpaid))}
    ${stat('Nominal Sudah Dibayar',money(paid))}
  </div><div class="card"><p class="muted">Export Excel bisa ditambahkan pada versi berikutnya.</p></div>`);
}

async function workerDashboard() {
  const [claims, subs, pays, tasks] = await Promise.all([
    sb.from('task_claims').select('status').eq('worker_id', me.id).eq('work_date', todayKey()),
    sb.from('submissions').select('status').eq('worker_id', me.id),
    sb.from('payments').select('amount,status').eq('worker_id', me.id),
    sb.from('tasks').select('*').eq('status','active')
  ]);
  const todayCounts = await getTodaySubmissionCounts((tasks.data || []).map(t => t.id));
  const availableCount = (tasks.data || []).filter(t => (todayCounts[t.id] || 0) < quotaPerDay(t)).length;
  const unpaid = (pays.data||[]).filter(p=>p.status==='unpaid').reduce((a,b)=>a+Number(b.amount||0),0);
  const paid = (pays.data||[]).filter(p=>p.status==='paid').reduce((a,b)=>a+Number(b.amount||0),0);
  setContent(`<div class="grid">
    ${stat('Task Tersedia',availableCount)}
    ${stat('Sedang Dikerjakan',(claims.data||[]).filter(c=>c.status==='in_progress').length)}
    ${stat('Menunggu Review',(subs.data||[]).filter(s=>s.status==='submitted').length)}
    ${stat('Approved',(subs.data||[]).filter(s=>s.status==='approved').length)}
    ${stat('Belum Dibayar',money(unpaid))}
    ${stat('Sudah Dibayar',money(paid))}
  </div>`);
}

async function workerAvailableTasks() {
  const { data } = await sb.from('tasks').select('*').eq('status','active').order('created_at',{ascending:false});
  const todayCounts = await getTodaySubmissionCounts((data || []).map(t => t.id));
  const { data: myClaims } = await sb.from('task_claims').select('task_id').eq('worker_id', me.id).eq('work_date', todayKey());
  const claimedSet = new Set((myClaims || []).map(c => c.task_id));
  const available = (data || []).filter(t => (todayCounts[t.id] || 0) < quotaPerDay(t) && !claimedSet.has(t.id));
  setContent(`<div class="card"><h3>Task Tersedia</h3>${availableTable(available, todayCounts)}</div>`);
  document.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => claimTask(b.dataset.claim));
  document.querySelectorAll('[data-task-detail]').forEach(b => b.onclick = () => taskDetail(b.dataset.taskDetail));
}

function availableTable(rows, todayCounts={}) {
  if (!rows.length) return '<p class="muted">Belum ada task tersedia. Bisa jadi kuota task hari ini sudah penuh.</p>';
  return `<table><thead><tr><th>Task</th><th>Bayaran</th><th>Kuota Hari Ini</th><th>Deadline</th><th>Aksi</th></tr></thead><tbody>
  ${rows.map(t=>`<tr><td><b>${t.title}</b><br>${(t.description||'').slice(0,120)}</td><td>${money(t.reward_amount)}</td><td>${todayCounts[t.id] || 0} / ${quotaPerDay(t)}</td><td>${t.deadline||'-'}</td><td class="actions"><button class="ghost" data-task-detail="${t.id}">Instruksi</button><button data-claim="${t.id}">Ambil Task</button></td></tr>`).join('')}
  </tbody></table>`;
}

async function taskDetail(id) {
  const { data, error } = await sb.from('tasks').select('*').eq('id', id).single();
  if (error) return toast(error.message);
  modal('Instruksi Task', `<p><b>${data.title}</b></p><p>${data.description||''}</p><p><b>Instruksi:</b><br>${data.instruction||'-'}</p><p><b>Link:</b> ${data.target_link ? `<a href="${data.target_link}" target="_blank">Buka target</a>` : '-'}</p><p><b>Bayaran:</b> ${money(data.reward_amount)}</p><p><b>Kuota per hari:</b> ${quotaPerDay(data)} submit</p>`);
}

async function claimTask(task_id) {
  const { data: task, error: taskErr } = await sb.from('tasks').select('*').eq('id', task_id).single();
  if (taskErr) return toast(taskErr.message);
  const counts = await getTodaySubmissionCounts([task_id]);
  if ((counts[task_id] || 0) >= quotaPerDay(task)) return toast('Kuota task hari ini sudah penuh. Besok akan aktif lagi.');
  const { error } = await sb.from('task_claims').insert({ task_id, worker_id:me.id, status:'in_progress', work_date: todayKey() });
  if (error) return toast(error.code === '23505' ? 'Task ini sudah Anda ambil hari ini.' : error.message);
  toast('Task berhasil diambil.');
  workerMyTasks();
}

async function workerMyTasks() {
  const { data } = await sb.from('task_claims').select('*, tasks(*)').eq('worker_id', me.id).eq('work_date', todayKey()).order('claimed_at',{ascending:false});
  setContent(`<div class="card"><h3>Task Saya Hari Ini</h3>${myTasksTable(data||[])}</div>`);
  document.querySelectorAll('[data-submit-task]').forEach(b => b.onclick = () => submitForm(b.dataset.submitTask, b.dataset.taskId));
}

function myTasksTable(rows) {
  if (!rows.length) return '<p class="muted">Belum ada task yang diambil.</p>';
  return `<table><thead><tr><th>Task</th><th>Bayaran</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
  ${rows.map(c=>`<tr><td><b>${c.tasks?.title||'-'}</b><br>${(c.tasks?.instruction||'').slice(0,100)}</td><td>${money(c.tasks?.reward_amount)}</td><td>${statusBadge(c.status)}</td><td>${c.status==='submitted' ? '<span class="muted">Sudah submit</span>' : `<button data-submit-task="${c.id}" data-task-id="${c.task_id}">Submit Hasil</button>`}</td></tr>`).join('')}
  </tbody></table>`;
}

function submitForm(claim_id, task_id) {
  modal('Submit Hasil Pekerjaan', `<div class="form-grid">
    <div class="full"><label>Upload Screenshot</label><input id="subFile" type="file" accept="image/*"></div>
    <div class="full"><label>Keterangan Hasil Pekerjaan</label><textarea id="subNote"></textarea></div>
    <div class="full"><label>Link Bukti Tambahan</label><input id="subProof" placeholder="opsional"></div>
  </div><div class="actions"><button id="btnSubmitWork">Kirim Submit</button></div>`);
  $('btnSubmitWork').onclick = () => submitWork(claim_id, task_id);
}

async function submitWork(claim_id, task_id) {
  const file = $('subFile').files[0];
  const result_note = $('subNote').value.trim();
  const proof_link = $('subProof').value.trim();
  if (!file || !result_note) return toast('Screenshot dan keterangan wajib diisi.');
  const { data: task, error: taskErr } = await sb.from('tasks').select('*').eq('id', task_id).single();
  if (taskErr) return toast(taskErr.message);
  const counts = await getTodaySubmissionCounts([task_id]);
  if ((counts[task_id] || 0) >= quotaPerDay(task)) return toast('Kuota task hari ini sudah penuh. Silakan pilih task lain atau coba besok.');
  const ext = file.name.split('.').pop();
  const path = `${me.id}/${task_id}/${Date.now()}.${ext}`;
  const up = await sb.storage.from('submission-screenshots').upload(path, file, { upsert:false });
  if (up.error) return toast(up.error.message);
  const { data: pub } = sb.storage.from('submission-screenshots').getPublicUrl(path);
  const { error } = await sb.from('submissions').insert({ task_id, claim_id, worker_id:me.id, screenshot_url:pub.publicUrl, result_note, proof_link, status:'submitted', work_date: todayKey() });
  if (error) return toast(error.message);
  await sb.from('task_claims').update({ status:'submitted' }).eq('id', claim_id);
  closeModal();
  toast('Hasil kerja berhasil dikirim.');
  workerMyTasks();
}

async function workerPayments() {
  const { data } = await sb.from('payments').select('*, submissions(tasks(title)), profiles(nama,email)').eq('worker_id', me.id).order('created_at',{ascending:false});
  setContent(`<div class="card"><h3>Riwayat Pembayaran</h3>${paymentsTable(data||[], false)}</div>`);
}

function workerProfile() {
  setContent(`<div class="card"><h3>Profil</h3><p><b>Nama:</b> ${me.nama}</p><p><b>Email:</b> ${me.email||'-'}</p><p><b>No HP:</b> ${me.no_hp||'-'}</p><p><b>E-money:</b> ${me.e_money||'-'}</p><p><b>Status:</b> ${me.status}</p></div>`);
}

function modal(title, body) {
  closeModal();
  const tpl = $('modalTemplate').content.cloneNode(true);
  tpl.querySelector('#modalTitle').textContent = title;
  tpl.querySelector('#modalBody').innerHTML = body;
  document.body.appendChild(tpl);
  $('modalClose').onclick = closeModal;
}
function closeModal() { document.querySelectorAll('.modal-backdrop').forEach(x => x.remove()); }

init();
