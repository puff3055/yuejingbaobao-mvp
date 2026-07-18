import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(scriptDir, "../public/data");
const read = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));

const claims = read("knowledge-claims.json");
const myths = read("myth-cards.json");
const practices = read("public-practice-atlas.json");
const provenance = read("research-provenance.json");

assert.equal(Array.isArray(claims.records), true);
assert.equal(Array.isArray(myths.records), true);
assert.equal(Array.isArray(practices.records), true);
assert.equal(claims.records.length, claims.metadata.recordCount);
assert.equal(myths.records.length, myths.metadata.recordCount);
assert.match(claims.metadata.releaseId, /^2026-07-15-r5/);
assert.equal(claims.metadata.releaseStatus, "working");
assert.equal(provenance.integrationMethod, "read_only_federated_export");
assert.equal(provenance.evidenceLanes.length, 2);
assert.match(provenance.linkPolicy, /不按关键词、URL或热度自动互证/);

for (const item of [...claims.records, ...myths.records]) {
  assert.ok(item.claim_id || item.myth_id);
  assert.equal(item.evidence_lane, "medical_or_official_background");
  assert.equal(item.knowledge_status, "research_background_candidate");
  assert.equal(item.clinical_product_review, "pending");
  assert.ok(item.located_source_count > 0);
  assert.ok(item.source_details.some((source) => source.url && source.locator_type !== "not_available" && source.locator_value));
}

for (const item of practices.records) {
  assert.equal(item.evidenceDomain, "public_experience_candidate");
  assert.notEqual(item.truthStatus, "verified");
}

const serialized = JSON.stringify({ claims, myths, practices, provenance });
assert.equal(/monid[_-]live_[A-Za-z0-9]+/i.test(serialized), false);

console.log(JSON.stringify({
  passed: true,
  claims: claims.records.length,
  myths: myths.records.length,
  publicCandidates: practices.records.length,
  releaseId: claims.metadata.releaseId,
  medicalDatabaseSha256: claims.metadata.canonicalDatabaseSha256,
}, null, 2));
