import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { selectEvidencePackets } from "./agentKnowledge.js";

const release = JSON.parse(await readFile(new URL("../public/data/knowledge-claims.json", import.meta.url), "utf8"));

test("ordinary pain conversation is not burdened with an automatic research dump", () => {
  assert.deepEqual(selectEvidencePackets(release.records, "我现在小腹特别痛，下午还有会"), []);
});

test("knowledge questions retrieve only located, non-review-required background", () => {
  const packets = selectEvidencePackets(release.records, "日历预测排卵靠谱吗，有没有研究？");
  assert.ok(packets.length > 0);
  packets.forEach((packet) => {
    assert.ok(packet.claimId);
    assert.ok(packet.publicationBoundary);
    assert.ok(packet.sources.length > 0);
    assert.ok(packet.sources[0].url);
    assert.ok(packet.sources[0].locator);
  });
});

test("a record waiting for required review cannot enter an Agent evidence packet", () => {
  const unsafe = {
    claim_id: "unsafe",
    claim_text_plain: "日历可以准确预测排卵",
    node_labels: "预测 排卵 日历",
    reviewer_required: 1,
    app_publication_status: "background_ready",
    located_source_count: 1,
    source_details: [{ url: "https://example.com", locator_type: "page", locator_value: "1" }],
  };
  assert.deepEqual(selectEvidencePackets([unsafe], "日历预测排卵靠谱吗？"), []);
});

