import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (name) => JSON.parse(await readFile(new URL(`../public/data/${name}`, import.meta.url), "utf8"));

test("professional knowledge export keeps release, source locators and pending review visible", async () => {
  const claims = await readJson("knowledge-claims.json");
  const myths = await readJson("myth-cards.json");
  assert.match(claims.metadata.releaseId, /^2026-07-15-r5/);
  assert.equal(claims.metadata.releaseStatus, "working");
  assert.ok(claims.records.length > 0);
  [...claims.records, ...myths.records].forEach((item) => {
    assert.ok(item.located_source_count > 0);
    assert.equal(item.clinical_product_review, "pending");
    assert.ok(item.source_details.some((source) => source.url && source.locator_value));
  });
});

test("public practices remain a separate unverified evidence lane", async () => {
  const atlas = await readJson("public-practice-atlas.json");
  assert.equal(atlas.metadata.productReadyCount, 0);
  assert.match(atlas.metadata.selectionScope, /不是全平台抽样/);
  atlas.records.forEach((item) => assert.equal(item.evidenceDomain, "public_experience_candidate"));
});
