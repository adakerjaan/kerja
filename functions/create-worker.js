const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function checkAdmin(env, token) {
  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  const profileRes = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?auth_user_id=eq.${user.id}&select=id,role,status`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  const profiles = await profileRes.json();
  const profile = profiles?.[0];
  if (!profile || profile.role !== 'admin' || profile.status !== 'active') return null;
  return profile;
}

export async function onRequestOptions() {
  return new Response(null, { headers: cors });
}

export async function onRequestPost({ request, env }) {
  try {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '');
    if (!token) return json({ error: 'Token tidak ada.' }, 401);

    const admin = await checkAdmin(env, token);
    if (!admin) return json({ error: 'Akses ditolak. Hanya admin.' }, 403);

    const body = await request.json();
    const nama = String(body.nama || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const no_hp = String(body.no_hp || '').trim();
    const e_money = String(body.e_money || '').trim();
    const password = String(body.password || '').trim();

    if (!nama || !email || !password) {
      return json({ error: 'Nama, email, dan password wajib diisi.' }, 400);
    }
    if (password.length < 6) {
      return json({ error: 'Password minimal 6 karakter.' }, 400);
    }

    const createRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { nama } }),
    });

    const created = await createRes.json();
    if (!createRes.ok) return json({ error: created.msg || created.error_description || 'Gagal membuat auth user.' }, 400);

    const profileRes = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ auth_user_id: created.id, nama, email, no_hp, e_money, role: 'worker', status: 'active' }),
    });

    const profile = await profileRes.json();
    if (!profileRes.ok) return json({ error: profile.message || 'Auth dibuat, tapi profile gagal dibuat.' }, 400);

    return json({ success: true, worker: profile[0] });
  } catch (err) {
    return json({ error: err.message || 'Terjadi kesalahan server.' }, 500);
  }
}
