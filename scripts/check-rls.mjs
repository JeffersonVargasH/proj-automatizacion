// Comprueba contra un proyecto Supabase real que RLS y Storage aíslan a cada usuario.
// Crea dos cuentas temporales (contraseñas aleatorias), intenta accesos cruzados y las borra al final.
// Uso: node scripts/check-rls.mjs   (lee .env.local)
import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').replace(/^﻿/, '').split(/\r?\n/)
  .filter(line => line.includes('=') && !line.startsWith('#'))
  .map(line => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);

let failures = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function makeUser(tag) {
  const email = `clic-rls-${tag}-${randomBytes(4).toString('hex')}@example.com`;
  const password = `${randomBytes(12).toString('base64url')}9a`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Prueba ${tag}`, business: `Negocio ${tag}` } });
  if (error) throw error;
  const client = createClient(url, publicKey, options);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

const users = [];
try {
  const a = await makeUser('a'); users.push(a);
  const b = await makeUser('b'); users.push(b);

  const { data: profileA } = await a.client.from('profiles').select('role, status, full_name').eq('id', a.id).single();
  check('al registrarse se crea el perfil como emprendedor activo', profileA?.role === 'entrepreneur' && profileA?.status === 'active' && profileA?.full_name === 'Prueba a');
  const { data: bizA } = await a.client.from('businesses').select('id, name');
  check('al registrarse se crea su primer negocio', bizA?.length === 1 && bizA[0].name === 'Negocio a');
  const { data: bizBAdmin } = await admin.from('businesses').select('id').eq('owner_id', b.id).single();

  const { data: seenB } = await a.client.from('businesses').select('id').eq('id', bizBAdmin.id);
  check('A no ve el negocio de B', seenB?.length === 0);
  const { error: updB } = await a.client.from('businesses').update({ name: 'hackeado' }).eq('id', bizBAdmin.id).select();
  const { data: bAfter } = await admin.from('businesses').select('name').eq('id', bizBAdmin.id).single();
  check('A no puede renombrar el negocio de B', bAfter.name === 'Negocio b', updB?.message);

  const { data: second, error: secondError } = await a.client.from('businesses').insert({ owner_id: a.id, name: 'Segundo negocio de A' }).select('id').single();
  check('A puede crear un segundo negocio', !!second && !secondError, secondError?.message);

  const pubId = randomUUID();
  const { error: pubError } = await a.client.from('publications').insert({ id: pubId, business_id: bizA[0].id, owner_id: a.id, title: 'Pan', design: { id: pubId } });
  check('A crea una publicación en su negocio', !pubError, pubError?.message);
  const { error: crossPub } = await a.client.from('publications').insert({ id: randomUUID(), business_id: bizBAdmin.id, owner_id: a.id, design: {} });
  check('A no puede crear publicaciones en el negocio de B', !!crossPub);
  const { data: bSeesPub } = await b.client.from('publications').select('id').eq('id', pubId);
  check('B no ve la publicación de A', bSeesPub?.length === 0);

  await a.client.from('profiles').update({ role: 'admin', status: 'active', full_name: 'Nombre nuevo' }).eq('id', a.id);
  const { data: escalated } = await admin.from('profiles').select('role, full_name').eq('id', a.id).single();
  check('A cambia su nombre pero no puede darse rol de admin', escalated.role === 'entrepreneur' && escalated.full_name === 'Nombre nuevo');
  const { data: otherProfiles } = await a.client.from('profiles').select('id');
  check('A solo ve su propio perfil', otherProfiles?.length === 1 && otherProfiles[0].id === a.id);

  const { error: upOwn } = await a.client.storage.from('media').upload(`${a.id}/${bizA[0].id}/prueba.png`, png, { contentType: 'image/png' });
  check('A sube una imagen a su carpeta', !upOwn, upOwn?.message);
  const { error: upCross } = await a.client.storage.from('media').upload(`${b.id}/x/intruso.png`, png, { contentType: 'image/png' });
  check('A no puede subir a la carpeta de B', !!upCross);
  const { data: signedByB } = await b.client.storage.from('media').createSignedUrl(`${a.id}/${bizA[0].id}/prueba.png`, 60);
  check('B no puede firmar ni ver la imagen de A', !signedByB?.signedUrl);
  const { data: signedByA } = await a.client.storage.from('media').createSignedUrl(`${a.id}/${bizA[0].id}/prueba.png`, 60);
  const fetched = signedByA?.signedUrl ? await fetch(signedByA.signedUrl) : null;
  check('la URL firmada de A descarga la imagen', fetched?.ok === true);
  const { error: svg } = await a.client.storage.from('media').upload(`${a.id}/x/malo.svg`, Buffer.from('<svg/>'), { contentType: 'image/svg+xml' });
  check('Storage rechaza SVG', !!svg);

  const { error: forged } = await a.client.from('activity_log').insert({ actor_id: b.id, action: 'falso', entity: 'x' });
  check('nadie escribe la auditoría directamente', !!forged);
  const { error: rpc } = await a.client.rpc('log_activity', { p_action: 'login', p_entity: 'session' });
  check('log_activity registra eventos propios', !rpc, rpc?.message);
  const { data: logA } = await a.client.from('activity_log').select('action, entity, actor_id');
  check('los triggers auditan altas y A solo ve su actividad', !!logA?.length && logA.every(row => row.actor_id === a.id || row.actor_id === null) && logA.some(row => row.entity === 'publications'));

  const anon = createClient(url, publicKey, options);
  const { data: anonRows } = await anon.from('businesses').select('id');
  check('sin sesión no se ve nada', !anonRows?.length);

  await admin.from('profiles').update({ status: 'suspended' }).eq('id', a.id);
  const { data: suspendedRows } = await a.client.from('businesses').select('id');
  check('una cuenta suspendida deja de ver sus datos aunque su token siga vigente', suspendedRows?.length === 0);
  const { error: suspendedWrite } = await a.client.from('businesses').insert({ owner_id: a.id, name: 'x' });
  check('una cuenta suspendida no puede escribir', !!suspendedWrite);
} catch (error) {
  failures++;
  console.error('✗ Error inesperado:', error.message || error);
} finally {
  for (const user of users) {
    const { data: files } = await admin.storage.from('media').list(user.id, { limit: 100 });
    for (const folder of files || []) {
      const { data: inner } = await admin.storage.from('media').list(`${user.id}/${folder.name}`, { limit: 100 });
      if (inner?.length) await admin.storage.from('media').remove(inner.map(file => `${user.id}/${folder.name}/${file.name}`));
    }
    await admin.from('activity_log').delete().eq('actor_id', user.id);
    await admin.auth.admin.deleteUser(user.id);
  }
  console.log(failures ? `\n${failures} comprobación(es) fallaron.` : '\nTodo en orden. Cuentas de prueba eliminadas.');
  process.exitCode = failures ? 1 : 0;
}
