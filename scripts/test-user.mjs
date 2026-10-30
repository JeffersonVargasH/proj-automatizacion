// Cuenta de prueba ya confirmada, para probar la app sin enviar correos.
// node scripts/test-user.mjs create [admin]  → la crea y guarda correo y contraseña en .env.test.local (ignorado por git)
// node scripts/test-user.mjs delete          → la borra con sus datos e imágenes
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';

const read = file => Object.fromEntries((fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '').replace(/^﻿/, '').split(/\r?\n/)
  .filter(line => line.includes('=') && !line.startsWith('#'))
  .map(line => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]));
const env = read('.env.local');
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [command, role] = process.argv.slice(2);

if (command === 'create') {
  const email = `clic-prueba-${randomBytes(3).toString('hex')}@example.com`;
  const password = `${randomBytes(10).toString('base64url')}7k`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Diana Prueba', business: 'Panadería Prueba' } });
  if (error) throw error;
  if (role === 'admin') await admin.from('profiles').update({ role: 'admin' }).eq('id', data.user.id);
  fs.writeFileSync('.env.test.local', `TEST_USER_ID=${data.user.id}\nTEST_USER_EMAIL=${email}\nTEST_USER_PASSWORD=${password}\n`);
  console.log(`Cuenta de prueba creada (${role === 'admin' ? 'admin' : 'emprendedor'}). Datos en .env.test.local`);
} else if (command === 'delete') {
  const { TEST_USER_ID: id } = read('.env.test.local');
  if (!id) { console.log('No hay cuenta de prueba.'); process.exit(0); }
  const { data: folders } = await admin.storage.from('media').list(id, { limit: 100 });
  for (const folder of folders || []) {
    const { data: files } = await admin.storage.from('media').list(`${id}/${folder.name}`, { limit: 1000 });
    if (files?.length) await admin.storage.from('media').remove(files.map(file => `${id}/${folder.name}/${file.name}`));
  }
  await admin.from('activity_log').delete().eq('actor_id', id);
  await admin.auth.admin.deleteUser(id);
  fs.rmSync('.env.test.local');
  console.log('Cuenta de prueba eliminada.');
} else console.log('Uso: node scripts/test-user.mjs create [admin] | delete');
