import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply(401, { error: 'Authentication required' });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return reply(503, { error: 'Server is not configured' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identity, error: identityError } = await admin.auth.getUser(token);
  if (identityError || !identity.user) return reply(401, { error: 'Session is invalid' });
  const userId = identity.user.id;

  try {
    const bucket = admin.storage.from('library-images');
    const paths = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await bucket.list(userId, { limit: 100, offset });
      if (error) throw error;
      for (const file of data ?? []) {
        if (file.id) paths.push(`${userId}/${file.name}`);
      }
      if ((data?.length ?? 0) < 100) break;
    }
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await bucket.remove(paths.slice(index, index + 100));
      if (error) throw error;
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;
    return reply(200, { ok: true });
  } catch (error) {
    console.error('account deletion failed', { userId, message: String(error) });
    return reply(500, { error: 'Deletion did not complete. Please retry.' });
  }
});
