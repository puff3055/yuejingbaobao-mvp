import {
  dedupeAndRankSources,
  fetchOfficialSearchSources,
  fetchPubMedSources,
  normalizeSourceUrl,
} from "./professionalSources.js";

const TOPIC_RULES = [
  { test: /痛经|小腹|下腹|腹痛|疼痛|痉挛/, terms: [/疼痛|痛经|功能影响|日常活动|污名|症状正常化/] },
  { test: /经量|大量出血|出血多|漏血|浸透|血块/, terms: [/经量|大量月经出血|HMB|出血|贫血|浸透/] },
  { test: /睡眠|失眠|早醒|睡不好/, terms: [/睡眠|经前|PMS|痛经/] },
  { test: /情绪|烦躁|焦虑|低落|PMS|PMDD|经前/, terms: [/PMS|PMDD|经前|情绪|睡眠|自伤/] },
  { test: /预测|日历|排卵日|什么时候来|周期第几天/, terms: [/预测|日历|排卵|周期长度|APP/] },
  { test: /排卵|黄体期|卵泡期|激素|内膜/, terms: [/排卵|黄体|卵泡|激素|子宫内膜|月经周期/] },
  { test: /超声|B超|检查正常|没事吗/, terms: [/超声|影像|正常检查|内膜异位/] },
  { test: /运动|周期同步|黄体期.*练|经期.*练/, terms: [/运动|周期同步|黄体期|体温/] },
  { test: /初潮|第一次月经/, terms: [/初潮|青春期|月经用品/] },
  { test: /围绝经|绝经|更年期/, terms: [/围绝经|绝经|更年期|绝经后出血/] },
  { test: /隐私|数据|上传|分享|第三方/, terms: [/隐私|数据|第三方|同意/] },
];

const KNOWLEDGE_INTENT = /为什么|可能是什么|什么原因|正常吗|靠谱吗|有没有证据|研究|文献|解释|能说明|是不是|会不会|怎么回事|知识/;

function isSafeBackgroundRecord(record) {
  return Number(record?.reviewer_required || 0) === 0
    && ["background_ready", "evidence_background"].includes(record?.app_publication_status)
    && Number(record?.located_source_count || 0) > 0
    && Array.isArray(record?.source_details)
    && record.source_details.some((source) => normalizeSourceUrl(source?.url) && source?.locator_type && source.locator_type !== "not_available");
}

function compactSource(source) {
  const url = normalizeSourceUrl(source?.url);
  if (!url) return null;
  return {
    sourceId: source.source_id,
    title: source.source_title,
    publisherOrAuthors: source.organization_or_authors,
    publishedAt: source.publication_year ? String(source.publication_year) : null,
    sourceType: source.source_type,
    url,
    locator: [source.locator_type, source.locator_value].filter(Boolean).join(" · "),
    verification: source.verification_status,
  };
}

export function isKnowledgeIntent(message = "") {
  return KNOWLEDGE_INTENT.test(message);
}

export function selectEvidencePackets(records = [], message = "", limit = 2, { force = false } = {}) {
  if (!force && !isKnowledgeIntent(message)) return [];
  const matchedRules = TOPIC_RULES.filter((rule) => rule.test.test(message));
  if (!matchedRules.length) return [];
  const terms = matchedRules.flatMap((rule) => rule.terms);
  return records
    .filter(isSafeBackgroundRecord)
    .map((record) => {
      const haystack = `${record.claim_text_plain || ""} ${record.node_labels || ""} ${record.population_and_context || ""}`;
      const score = terms.reduce((total, term) => total + (term.test(haystack) ? 3 : 0), 0)
        + (record.evidence_strength === "强" ? 1 : 0)
        + Math.min(2, Number(record.fulltext_source_count || 0));
      return { record, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ record }) => ({
      claimId: record.claim_id,
      claim: record.claim_text_plain,
      evidenceStrength: record.evidence_strength,
      appliesTo: record.population_and_context,
      cannotConclude: record.counterexample_or_conflict,
      limitations: record.limitations,
      publicationBoundary: record.publication_boundary,
      clinicalReview: record.clinical_product_review,
      sources: record.source_details
        .filter((source) => source?.locator_type && source.locator_type !== "not_available")
        .map(compactSource)
        .filter(Boolean)
        .slice(0, 3),
    }));
}

export function localPacketsToSources(packets = []) {
  return packets.flatMap((packet) => packet.sources.map((source) => ({
    title: source.title,
    publisherOrAuthors: source.publisherOrAuthors,
    publishedAt: source.publishedAt,
    url: source.url,
    doi: source.url.includes("doi.org/") ? source.url.split("doi.org/")[1] : null,
    journal: source.publisherOrAuthors,
    supportingExcerpt: packet.claim,
    populationOrContext: packet.appliesTo,
    limitations: [packet.cannotConclude, packet.limitations, packet.publicationBoundary].filter(Boolean).join(" "),
    sourceType: source.sourceType,
    origin: "local_release",
  })));
}

export async function retrieveProfessionalSources({
  records = [],
  message = "",
  query = "",
  officialQuery = "",
  category = "basic",
  apiKey = "",
  searchEndpoint,
  fetchImpl = fetch,
  signal,
  limit = 8,
} = {}) {
  const local = localPacketsToSources(selectEvidencePackets(records, message, 3, { force: true }));
  const pubmedPromise = fetchPubMedSources(query, { fetchImpl, signal, limit: 5 }).catch(() => []);
  const officialPromise = ["safety", "action_effectiveness", "basic"].includes(category)
    ? fetchOfficialSearchSources(officialQuery || query, { apiKey, fetchImpl, signal, limit: 4, endpoint: searchEndpoint }).catch(() => [])
    : Promise.resolve([]);
  const [pubmed, official] = await Promise.all([pubmedPromise, officialPromise]);
  const sourcePriority = ["safety", "action_effectiveness", "basic"].includes(category)
    ? { official: 0, local: 1, pubmed: 2 }
    : { local: 0, pubmed: 1, official: 2 };
  return dedupeAndRankSources([
    ...official.map((source) => ({ ...source, priority: sourcePriority.official })),
    ...local.map((source) => ({ ...source, priority: sourcePriority.local })),
    ...pubmed.map((source) => ({ ...source, priority: sourcePriority.pubmed })),
  ], limit);
}
