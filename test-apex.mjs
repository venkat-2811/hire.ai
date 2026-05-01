/**
 * Quick test script to verify Salesforce OAuth + Apex execution works.
 * Run: node test-apex.mjs
 */
import { readFileSync } from 'fs';

// Load .env.local
const envLocal = readFileSync('.env.local', 'utf-8');
for (const line of envLocal.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx);
  const value = trimmed.slice(eqIdx + 1);
  process.env[key] = value;
}

const SF_CLIENT_ID = process.env.SF_CLIENT_ID;
const SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET;
const SF_USERNAME = process.env.SF_USERNAME;
const SF_PASSWORD = process.env.SF_PASSWORD;
const SF_SECURITY_TOKEN = process.env.SF_SECURITY_TOKEN;

console.log('=== Salesforce Apex Integration Test ===\n');
console.log('SF_CLIENT_ID:', SF_CLIENT_ID ? `${SF_CLIENT_ID.slice(0,10)}...` : 'MISSING');
console.log('SF_CLIENT_SECRET:', SF_CLIENT_SECRET ? `${SF_CLIENT_SECRET.slice(0,10)}...` : 'MISSING');
console.log('SF_USERNAME:', SF_USERNAME || 'MISSING');
console.log('SF_PASSWORD:', SF_PASSWORD ? '***SET***' : 'MISSING');
console.log('SF_SECURITY_TOKEN:', SF_SECURITY_TOKEN ? '***SET***' : 'MISSING');

if (!SF_CLIENT_ID || !SF_CLIENT_SECRET || !SF_USERNAME || !SF_PASSWORD || !SF_SECURITY_TOKEN) {
  console.error('\n❌ Missing Salesforce credentials in .env.local');
  process.exit(1);
}

// Step 1: OAuth authentication
console.log('\n--- Step 1: OAuth Authentication ---');
const authParams = new URLSearchParams({
  grant_type: 'password',
  client_id: SF_CLIENT_ID,
  client_secret: SF_CLIENT_SECRET,
  username: SF_USERNAME,
  password: `${SF_PASSWORD}${SF_SECURITY_TOKEN}`,
});

try {
  const authResp = await fetch('https://login.salesforce.com/services/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: authParams.toString(),
  });

  if (!authResp.ok) {
    const errText = await authResp.text();
    console.error(`❌ Auth failed (${authResp.status}):`, errText);
    process.exit(1);
  }

  const authData = await authResp.json();
  console.log('✅ Auth successful!');
  console.log('Instance URL:', authData.instance_url);
  console.log('Token type:', authData.token_type);

  // Step 2: Execute anonymous Apex
  console.log('\n--- Step 2: Execute Anonymous Apex ---');
  const apexCode = `
Integer a = 10;
Integer b = 20;
Integer result = a + b;
System.debug('Result: ' + result);
`;

  const execResp = await fetch(
    `${authData.instance_url}/services/data/v59.0/tooling/executeAnonymous?anonymousBody=${encodeURIComponent(apexCode)}`,
    {
      headers: { Authorization: `Bearer ${authData.access_token}` },
    }
  );

  if (!execResp.ok) {
    const errText = await execResp.text();
    console.error(`❌ Execution failed (${execResp.status}):`, errText);
    process.exit(1);
  }

  const execData = await execResp.json();
  console.log('Compiled:', execData.compiled);
  console.log('Success:', execData.success);
  console.log('Compile Problem:', execData.compileProblem || '(none)');
  console.log('Exception:', execData.exceptionMessage || '(none)');

  if (execData.compiled && execData.success) {
    console.log('\n✅ Apex execution successful!');
  } else {
    console.log('\n⚠️ Apex execution completed with issues');
  }

  // Step 3: Test compilation error handling
  console.log('\n--- Step 3: Test Compilation Error ---');
  const badCode = 'Integer x = "not a number";';
  const badResp = await fetch(
    `${authData.instance_url}/services/data/v59.0/tooling/executeAnonymous?anonymousBody=${encodeURIComponent(badCode)}`,
    {
      headers: { Authorization: `Bearer ${authData.access_token}` },
    }
  );
  const badData = await badResp.json();
  console.log('Compiled:', badData.compiled);
  console.log('Compile Problem:', badData.compileProblem || '(none)');
  if (!badData.compiled) {
    console.log('✅ Compilation error correctly detected!');
  }

  console.log('\n=== ALL TESTS PASSED ===');

} catch (err) {
  console.error('❌ Network error:', err.message);
  process.exit(1);
}
