// Run only against a seeded development database. Does not send email.
import assert from 'node:assert/strict';
const base = process.env.SMOKE_API_URL || 'http://localhost:3000';
const password = process.env.SEED_TEST_PASSWORD;
if (!password) throw new Error('Set SEED_TEST_PASSWORD to the password used when seeding your development database.');
const roles = ['admin', 'student', 'trainer', 'faculty', 'mentor', 'coordinator'];
let checks = 0;
for (const role of roles) {
  const login = await fetch(base + '/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:role+'@hope.dev',password})});
  assert.equal(login.status, 200, role + ' login');
  const token = (await login.json()).data.accessToken;
  const headers = {Authorization:'Bearer '+token,'Content-Type':'application/json'};
  const profileResponse = await fetch(base+'/users/me',{headers});
  assert.equal(profileResponse.status,200);
  const profile = (await profileResponse.json()).data;
  assert.equal(profile.role.name,role.toUpperCase());
  assert.equal('passwordHash' in profile,false);
  const saved = await fetch(base+'/users/me',{method:'PATCH',headers,body:JSON.stringify({name:profile.name,phone:profile.phone})});
  assert.equal(saved.status,200,role+' profile update');
  const forbidden = await fetch(base+'/users/me',{method:'PATCH',headers,body:JSON.stringify({roleId:'forbidden'})});
  assert.equal(forbidden.status,400,role+' strict validation');
  // End the session created for this check; do not leave refresh sessions behind.
  const cookie = login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
  await fetch(base+'/auth/logout',{method:'POST',headers:{...headers,Cookie:cookie},body:'{}'});
  checks += 4;
  console.log('PASS '+role+': login, safe profile, profile save, forbidden-field rejection');
}
console.log(checks+' smoke checks passed.');
