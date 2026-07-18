import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../..");
const appDataDir = path.join(projectRoot, "hackathon-mvp/public/data");
const medicalDbPath = path.join(
  projectRoot,
  "docs/research/studies/R004-clinical-safety/B5-continuous-locator-cause-graph/menstrual-knowledge-r5.sqlite",
);
const publicExperienceDbPath = path.join(
  projectRoot,
  "docs/research/studies/R006-public-practice-atlas/r006-public-practice.sqlite",
);

const hashFile = (filePath) => createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
const writeJson = (name, value) => fs.writeFileSync(path.join(appDataDir, name), `${JSON.stringify(value, null, 2)}\n`);
const uniqueBy = (rows, key) => [...new Map(rows.map((row) => [key(row), row])).values()];

const medical = new DatabaseSync(medicalDbPath, { readOnly: true });
const publicExperience = new DatabaseSync(publicExperienceDbPath, { readOnly: true });

const metadata = Object.fromEntries(
  medical.prepare("SELECT key, value FROM metadata ORDER BY key").all().map(({ key, value }) => [key, value]),
);
const release = medical.prepare("SELECT * FROM releases WHERE release_id = ?").get(metadata.current_working_release);

// R004's own handoff explicitly says v_app_ready_claims is only a background-candidate
// view. The prototype therefore adds a stricter, reproducible gate: at least one
// active source must have a registered locator. This is still not clinical sign-off.
const claimRows = medical.prepare(`
  SELECT a.*
  FROM v_app_ready_claims a
  WHERE EXISTS (
    SELECT 1
    FROM v_claim_evidence_cards e
    WHERE e.claim_id = a.claim_id
      AND e.locator_type <> 'not_available'
      AND NULLIF(TRIM(e.locator_value), '') IS NOT NULL
  )
  ORDER BY a.module_id, a.claim_id
`).all();

const claimSources = medical.prepare(`
  SELECT source_id, source_title, organization_or_authors, publication_year,
         source_type, study_design, sample_size, sample_and_region, url,
         doi_or_identifier, source_limitations, support_role, directness,
         locator_type, locator_value, evidence_note, verification_status,
         verified_date
  FROM v_claim_evidence_cards
  WHERE claim_id = ?
  ORDER BY
    CASE verification_status WHEN 'fulltext_checked' THEN 0 WHEN 'abstract_checked' THEN 1 ELSE 2 END,
    CASE directness WHEN 'direct' THEN 0 WHEN 'synthesis' THEN 1 ELSE 2 END,
    source_id
`);

const claimRecords = claimRows.map((claim) => {
  const sourceDetails = uniqueBy(claimSources.all(claim.claim_id), (row) => [row.source_id, row.locator_type, row.locator_value].join("|"));
  return {
    ...claim,
    source_details: sourceDetails,
    located_source_count: sourceDetails.filter((source) => source.locator_type !== "not_available" && source.locator_value).length,
    fulltext_source_count: sourceDetails.filter((source) => source.verification_status === "fulltext_checked").length,
    evidence_lane: "medical_or_official_background",
    knowledge_status: "research_background_candidate",
    clinical_product_review: "pending",
    publication_boundary: "研究背景候选；至少一条来源有定位。尚未完成妇产科产品级终审，不得用于个体诊断或处方。",
  };
});

const mythRows = medical.prepare(`
  SELECT m.*
  FROM v_myth_cards m
  WHERE EXISTS (
    SELECT 1
    FROM myth_claims mc
    JOIN claim_sources cs ON cs.claim_id = mc.claim_id
    WHERE mc.myth_id = m.myth_id
      AND cs.locator_type <> 'not_available'
      AND NULLIF(TRIM(cs.locator_value), '') IS NOT NULL
  )
  ORDER BY m.theme, m.myth_id
`).all();

const mythSources = medical.prepare(`
  SELECT c.claim_id, c.reviewer_required, c.app_publication_status,
         s.source_id, s.title AS source_title, s.organization_or_authors,
         s.publication_year, s.source_type, s.study_design, s.url,
         cs.locator_type, cs.locator_value, cs.directness,
         cs.verification_status, cs.evidence_note
  FROM myth_claims mc
  JOIN claims c ON c.claim_id = mc.claim_id
  JOIN claim_sources cs ON cs.claim_id = c.claim_id
  JOIN sources s ON s.source_id = cs.source_id
  WHERE mc.myth_id = ? AND c.status = 'active' AND s.source_status = 'active'
  ORDER BY c.claim_id, s.source_id
`);

const mythRecords = mythRows.map((myth) => {
  const sourceDetails = uniqueBy(mythSources.all(myth.myth_id), (row) => [row.claim_id, row.source_id, row.locator_type, row.locator_value].join("|"));
  return {
    ...myth,
    source_details: sourceDetails,
    located_source_count: sourceDetails.filter((source) => source.locator_type !== "not_available" && source.locator_value).length,
    linked_claims_requiring_review: new Set(sourceDetails.filter((source) => source.reviewer_required).map((source) => source.claim_id)).size,
    evidence_lane: "medical_or_official_background",
    knowledge_status: "research_background_candidate",
    clinical_product_review: "pending",
    publication_boundary: "误解纠正研究卡；来源可追溯，但仍待妇产科产品级终审。不能替代个体评估。",
  };
});

const medicalCounts = medical.prepare(`
  SELECT
    (SELECT COUNT(*) FROM sources WHERE source_status='active') AS active_sources,
    (SELECT COUNT(*) FROM claims WHERE status='active') AS active_claims,
    (SELECT COUNT(*) FROM claim_sources) AS claim_source_links,
    (SELECT COUNT(*) FROM expert_reviews WHERE decision='pending') AS pending_expert_reviews,
    (SELECT COUNT(*) FROM claim_sources WHERE locator_type='not_available') AS unlocated_links
`).get();

const run = publicExperience.prepare("SELECT * FROM research_runs ORDER BY created_at DESC LIMIT 1").get();
const publicCounts = publicExperience.prepare(`
  SELECT
    (SELECT COUNT(*) FROM sources) AS sources,
    (SELECT COUNT(*) FROM practices_or_claims) AS candidates,
    (SELECT COUNT(*) FROM evidence_links) AS evidence_links,
    (SELECT COUNT(*) FROM v_ready_for_product) AS product_ready
`).get();

const sharedMetadata = {
  title: "月经宝宝专业知识演示发布",
  generatedAt: new Date().toISOString(),
  canonicalDatabase: path.relative(projectRoot, medicalDbPath),
  canonicalDatabaseSha256: hashFile(medicalDbPath),
  releaseId: release.release_id,
  releaseStatus: release.status,
  schemaVersion: metadata.schema_version,
  scope: metadata.scope,
  sourceCount: medicalCounts.active_sources,
  pendingExpertReviews: medicalCounts.pending_expert_reviews,
  selectionRule: "v_app_ready_claims / v_myth_cards 中至少一条活动来源具有非 not_available 定位",
  publicationBoundary: "仅供黑客松教育原型展示；不是临床发布、诊断或处方。妇产科产品级终审仍待完成。",
};

fs.mkdirSync(appDataDir, { recursive: true });
writeJson("knowledge-claims.json", { metadata: { ...sharedMetadata, recordCount: claimRecords.length, recordType: "claim" }, records: claimRecords });
writeJson("myth-cards.json", { metadata: { ...sharedMetadata, recordCount: mythRecords.length, recordType: "myth_correction" }, records: mythRecords });
writeJson("research-provenance.json", {
  generatedAt: sharedMetadata.generatedAt,
  integrationMethod: "read_only_federated_export",
  evidenceLanes: [
    {
      id: "medical_or_official_background",
      canonicalDatabase: sharedMetadata.canonicalDatabase,
      databaseSha256: sharedMetadata.canonicalDatabaseSha256,
      releaseId: sharedMetadata.releaseId,
      releaseStatus: sharedMetadata.releaseStatus,
      counts: { ...medicalCounts, exported_claims: claimRecords.length, exported_myths: mythRecords.length },
      boundary: sharedMetadata.publicationBoundary,
    },
    {
      id: "public_experience_candidate",
      canonicalDatabase: path.relative(projectRoot, publicExperienceDbPath),
      databaseSha256: hashFile(publicExperienceDbPath),
      releaseId: run.run_id,
      releaseStatus: "candidate_pool",
      counts: publicCounts,
      boundary: run.evidence_boundary,
      selectionScope: run.selection_scope,
    },
  ],
  linkPolicy: "两条证据泳道不按关键词、URL或热度自动互证。只有 R006 evidence_links 中经过人工审阅的显式 external_claim_id 才建立关系。",
});

console.log(JSON.stringify({
  releaseId: sharedMetadata.releaseId,
  medicalSourceCount: medicalCounts.active_sources,
  exportedClaims: claimRecords.length,
  exportedMyths: mythRecords.length,
  publicCandidates: publicCounts.candidates,
  publicProductReady: publicCounts.product_ready,
}, null, 2));

medical.close();
publicExperience.close();
