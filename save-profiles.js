/**
 * Usage: node save-profiles.js '{"公司名":{"summary":"...","tags":["..."]}}'
 * Merges new profiles into company-profiles.json
 */
const fs = require('fs');
const path = require('path');

const PROFILES_PATH = path.join(__dirname, 'data', 'company-profiles.json');
const PENDING_PATH = path.join(__dirname, 'data', 'pending-profiles.json');

const input = process.argv[2];
if (!input) { console.error('Usage: node save-profiles.js \'{"公司名":{"summary":"...","tags":["..."]}}\''); process.exit(1); }

const newProfiles = JSON.parse(input);
const profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf-8'));

let added = 0;
for (const [name, data] of Object.entries(newProfiles)) {
  if (data.summary && data.tags) {
    profiles[name] = data;
    added++;
  }
}

fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2), 'utf-8');

// Remove saved companies from pending list
let pending = [];
try { pending = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf-8')); } catch {}
pending = pending.filter(c => !newProfiles[c]);
fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2), 'utf-8');

console.log(`Saved ${added} profiles. Total: ${Object.keys(profiles).length}. Pending: ${pending.length}`);
