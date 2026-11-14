// test.js — Integration test for CORTEX backend services
// Run with: node test.js
'use strict';

const http   = require('http');
const crypto = require('crypto');
require('dotenv').config();

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'your-webhook-secret';
const API_PORT       = 3001;
const WEBHOOK_PORT   = 3002;

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function sign(payload) {
  return 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
}

function pass(label) { console.log(`  ✅  ${label}`); }
function fail(label, detail) { console.error(`  ❌  ${label}: ${detail}`); process.exitCode = 1; }

// ── Tests ──────────────────────────────────────────────────────────────────

async function testGetRepos() {
  console.log('\n── TEST 1: GET /api/repos ─────────────────────────────────────');
  const res = await makeRequest({ hostname: 'localhost', port: API_PORT, path: '/api/repos', method: 'GET' });
  console.log(`   Status : ${res.status}`);
  console.log(`   Body   : ${res.body}`);
  if (res.status === 200) pass('Returns 200 with JSON array');
  else fail('Expected 200', `got ${res.status}`);
}

async function testWebhookPush() {
  console.log('\n── TEST 2: POST /webhook — push event ─────────────────────────');
  // Shape mirrors a real GitHub `push` payload: the RAG worker reads
  // `after` (head SHA), `repository.owner.login`, `repository.name`, `commits[].{added,modified,removed}`.
  const payload = JSON.stringify({
    ref: 'refs/heads/main',
    before: '0000000000000000000000000000000000000000',
    after: 'abc123def456abc123def456abc123def456abc1',
    commits: [{ added: ['src/index.ts'], modified: [], removed: [] }],
    repository: { id: 1, name: 'test-repo', full_name: 'testuser/test-repo', owner: { login: 'testuser' } },
  });
  const sig = sign(payload);
  const res = await makeRequest({
    hostname: 'localhost', port: WEBHOOK_PORT, path: '/webhook', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'x-github-event': 'push', 'x-hub-signature-256': sig },
  }, payload);
  console.log(`   Status : ${res.status}`);
  console.log(`   Body   : ${res.body}`);
  if (res.status === 200) pass('Push event queued (200)');
  else fail('Expected 200', `got ${res.status} — ${res.body}`);
}

async function testWebhookPR() {
  console.log('\n── TEST 3: POST /webhook — pull_request event ─────────────────');
  // Shape mirrors a real GitHub `pull_request` payload: the Review worker reads
  // `action`, `repository.owner.login`, `repository.name`, and `pull_request.number`.
  const payload = JSON.stringify({
    action: 'opened', number: 42,
    pull_request: { number: 42, title: 'Add feature X', head: { sha: 'abc123' } },
    repository: { id: 1, name: 'test-repo', full_name: 'testuser/test-repo', owner: { login: 'testuser' } },
  });
  const sig = sign(payload);
  const res = await makeRequest({
    hostname: 'localhost', port: WEBHOOK_PORT, path: '/webhook', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'x-github-event': 'pull_request', 'x-hub-signature-256': sig },
  }, payload);
  console.log(`   Status : ${res.status}`);
  console.log(`   Body   : ${res.body}`);
  if (res.status === 200) pass('PR event queued (200)');
  else fail('Expected 200', `got ${res.status} — ${res.body}`);
}

async function testWebhookPing() {
  console.log('\n── TEST 4: POST /webhook — ping event ─────────────────────────');
  const payload = JSON.stringify({ zen: 'Keep it logically awesome.', hook_id: 1 });
  const sig = sign(payload);
  const res = await makeRequest({
    hostname: 'localhost', port: WEBHOOK_PORT, path: '/webhook', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'x-github-event': 'ping', 'x-hub-signature-256': sig },
  }, payload);
  console.log(`   Status : ${res.status}`);
  console.log(`   Body   : ${res.body}`);
  if (res.status === 200 && res.body === 'pong') pass('Ping answered with pong (200)');
  else fail('Expected 200 pong', `got ${res.status} — ${res.body}`);
}

async function testWebhookInstallation() {
  console.log('\n── TEST 5: POST /webhook — installation created ───────────────');
  const payload = JSON.stringify({
    action: 'created',
    installation: { id: 99887766, account: { login: 'testuser' } },
    repositories: [{ id: 1, name: 'test-repo', full_name: 'testuser/test-repo' }],
  });
  const sig = sign(payload);
  const res = await makeRequest({
    hostname: 'localhost', port: WEBHOOK_PORT, path: '/webhook', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'x-github-event': 'installation', 'x-hub-signature-256': sig },
  }, payload);
  console.log(`   Status : ${res.status}`);
  console.log(`   Body   : ${res.body}`);
  if (res.status === 200) pass('Installation event accepted and queued (200)');
  else fail('Expected 200', `got ${res.status} — ${res.body}`);
}

async function testBadSignature() {
  console.log('\n── TEST 6: POST /webhook — bad signature (expect 401) ─────────');
  const payload = JSON.stringify({ ref: 'refs/heads/main', repository: { name: 'test-repo' } });
  const res = await makeRequest({
    hostname: 'localhost', port: WEBHOOK_PORT, path: '/webhook', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'x-github-event': 'push', 'x-hub-signature-256': 'sha256=invalidsignature1234' },
  }, payload);
  console.log(`   Status : ${res.status}`);
  console.log(`   Body   : ${res.body}`);
  if (res.status === 401) pass('Bad signature correctly rejected (401)');
  else fail('Expected 401', `got ${res.status}`);
}

// ── Run ────────────────────────────────────────────────────────────────────

(async () => {
  console.log('CORTEX Backend Integration Tests');
  console.log('==================================');
  try {
    await testGetRepos();
    await testWebhookPush();
    await testWebhookPR();
    await testWebhookPing();
    await testWebhookInstallation();
    await testBadSignature();
  } catch (err) {
    console.error('\nFatal error:', err.message);
    process.exitCode = 1;
  }
  console.log('\n==================================');
  console.log(process.exitCode ? '❌ Some tests failed.' : '✅ All tests passed!');
})();
