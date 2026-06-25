const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function checkAdmin(env, token) {
  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` } });
  if (!userRes.ok) return false;
  const user = await userRes.json();
  const pRes = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?auth_user_id=eq.${user.id}&select=role,status`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
  const rows = await pRes.json();
  return rows?.[0]?.role === 'admin' && rows?.[0]?.status === 'active';
}

export async function onRequestOptions() { return new Response(null, { headers: cors }); }

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return json({ error: 'Token tidak ada.' }, 401);
    if (!(await checkAdmin(env, token))) return json({ error: 'Akses ditolak.' }, 403);
    const { auth_user_id, password } = await request.json();
    if (!auth_user_id || !password || String(password).length < 6) return json({ error: 'Data tidak valid. Password minimal 6 karakter.' }, 400);

    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${auth_user_id}`, {
      method: 'PUT',
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) return json({ error: data.msg || 'Gagal reset password.' }, 400);
    return json({ success: true });
  } catch (err) { return json({ error: err.message || 'Server error.' }, 500); }
}
