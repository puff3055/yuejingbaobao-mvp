const PUBMED_EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const STEPFUN_SEARCH = "https://api.stepfun.com/v1/search";

export const PREFERRED_JOURNALS = [
  "Human Reproduction Update",
  "Human Reproduction",
  "Fertility and Sterility",
  "American Journal of Obstetrics and Gynecology",
  "Obstetrics & Gynecology",
  "BMJ Sexual & Reproductive Health",
  "Women's Reproductive Health",
  "Reproductive Health",
  "BMC Women's Health",
  "Journal of Pediatric and Adolescent Gynecology",
  "Journal of Medical Internet Research",
  "Journal of Endometriosis and Pelvic Pain Disorders",
  "Pain",
  "Journal of Women's Health",
  "中华妇产科杂志",
];

const PREFERRED_JOURNAL_ALIASES = new Map([
  ["ajog", "American Journal of Obstetrics and Gynecology"],
  ["jmir", "Journal of Medical Internet Research"],
  ["obstet gynecol", "Obstetrics & Gynecology"],
  ["zhonghua fu chan ke za zhi", "中华妇产科杂志"],
]);

const TRUSTED_OFFICIAL_HOSTS = [
  "who.int",
  "nice.org.uk",
  "acog.org",
  "rcog.org.uk",
  "cdc.gov",
  "nhs.uk",
  "gov.cn",
  "nhc.gov.cn",
  "chinacdc.cn",
  "cma.org.cn",
  "ncbi.nlm.nih.gov",
  "pubmed.ncbi.nlm.nih.gov",
];

function decodeXml(value = "") {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value, max = 4000) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function normalizeSourceUrl(value = "") {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    url.hash = "";
    [...url.searchParams.keys()].forEach((key) => {
      if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    });
    if (url.hostname === "doi.org") url.pathname = url.pathname.toLowerCase();
    return url.toString();
  } catch {
    return null;
  }
}

function hostMatches(hostname, allowed) {
  return allowed.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export function isTrustedOfficialUrl(value = "") {
  const normalized = normalizeSourceUrl(value);
  if (!normalized) return false;
  return hostMatches(new URL(normalized).hostname, TRUSTED_OFFICIAL_HOSTS);
}

function journalRank(journal = "") {
  const normalized = journal.toLowerCase().replace(/[.&]/g, " ").replace(/\s+/g, " ").trim();
  const alias = PREFERRED_JOURNAL_ALIASES.get(normalized);
  const candidate = (alias || journal).toLowerCase();
  const index = PREFERRED_JOURNALS.findIndex((name) => {
    const target = name.toLowerCase();
    return candidate === target || candidate.includes(target) || target.includes(candidate);
  });
  return index === -1 ? PREFERRED_JOURNALS.length + 1 : index;
}

export function dedupeAndRankSources(sources = [], limit = 8) {
  const deduped = new Map();
  sources.forEach((source) => {
    const url = normalizeSourceUrl(source?.url);
    if (!url) return;
    const doi = cleanText(source?.doi, 240).toLowerCase();
    const key = doi ? `doi:${doi.replace(/^https?:\/\/doi\.org\//, "")}` : `url:${url}`;
    const normalized = {
      title: cleanText(source?.title, 600),
      publisherOrAuthors: cleanText(source?.publisherOrAuthors, 480),
      publishedAt: cleanText(source?.publishedAt, 80) || null,
      url,
      doi: doi || null,
      journal: cleanText(source?.journal, 240) || null,
      supportingExcerpt: cleanText(source?.supportingExcerpt, 4200),
      populationOrContext: cleanText(source?.populationOrContext, 800) || null,
      limitations: cleanText(source?.limitations, 800) || null,
      sourceType: cleanText(source?.sourceType, 120) || null,
      origin: cleanText(source?.origin, 40) || "unknown",
      priority: Number.isFinite(source?.priority) ? source.priority : 10,
      retrievalRank: Number.isFinite(source?.retrievalRank) ? source.retrievalRank : 999,
    };
    if (!normalized.title || !normalized.supportingExcerpt) return;
    const existing = deduped.get(key);
    if (!existing || normalized.supportingExcerpt.length > existing.supportingExcerpt.length) deduped.set(key, normalized);
  });
  return [...deduped.values()]
    .sort((left, right) => {
      const priorityDelta = left.priority - right.priority;
      if (priorityDelta) return priorityDelta;
      const officialDelta = Number(isTrustedOfficialUrl(right.url)) - Number(isTrustedOfficialUrl(left.url));
      if (officialDelta) return officialDelta;
      const retrievalDelta = left.retrievalRank - right.retrievalRank;
      if (retrievalDelta) return retrievalDelta;
      const journalDelta = journalRank(left.journal || left.publisherOrAuthors) - journalRank(right.journal || right.publisherOrAuthors);
      if (journalDelta) return journalDelta;
      return right.supportingExcerpt.length - left.supportingExcerpt.length;
    })
    .slice(0, limit);
}

export function buildPreferredPubMedQuery(query = "") {
  const cleaned = cleanText(query, 500);
  if (!cleaned) return "";
  const journals = PREFERRED_JOURNALS.map((name) => `\"${name}\"[jour]`).join(" OR ");
  return `(${cleaned}) AND (${journals})`;
}

function pubmedParams(extra = {}) {
  const params = new URLSearchParams({ tool: process.env.NCBI_TOOL || "menstrual_baby", ...extra });
  if (process.env.NCBI_EMAIL) params.set("email", process.env.NCBI_EMAIL);
  if (process.env.NCBI_API_KEY) params.set("api_key", process.env.NCBI_API_KEY);
  return params;
}

function firstXml(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function allXml(block, tag) {
  return [...block.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((match) => decodeXml(match[1])).filter(Boolean);
}

function parsePubMedXml(xml = "", idOrder = []) {
  const rankByPmid = new Map(idOrder.map((id, index) => [String(id), index]));
  return [...String(xml).matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/gi)].flatMap((match) => {
    const block = match[1];
    const pmid = firstXml(block, "PMID");
    const title = firstXml(block, "ArticleTitle");
    const abstract = allXml(block, "AbstractText").join(" ");
    if (!pmid || !title || !abstract) return [];
    const journal = firstXml(block, "Title") || firstXml(block, "ISOAbbreviation");
    const year = firstXml(block, "Year") || firstXml(block, "MedlineDate");
    const authors = [...block.matchAll(/<Author(?:\s[^>]*)?>([\s\S]*?)<\/Author>/gi)].slice(0, 5).map((authorMatch) => {
      const author = authorMatch[1];
      return [firstXml(author, "LastName"), firstXml(author, "Initials")].filter(Boolean).join(" ");
    }).filter(Boolean);
    const doiMatch = [...block.matchAll(/<ArticleId[^>]*IdType="doi"[^>]*>([\s\S]*?)<\/ArticleId>/gi)][0];
    const doi = doiMatch ? decodeXml(doiMatch[1]).toLowerCase() : null;
    return [{
      title,
      publisherOrAuthors: authors.length ? authors.join("、") : journal,
      publishedAt: year || null,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      doi,
      journal: journal || null,
      supportingExcerpt: abstract,
      populationOrContext: null,
      limitations: "摘要信息不能替代全文的方法、样本与局限审读。",
      sourceType: "PubMed indexed article",
      origin: "pubmed",
      retrievalRank: rankByPmid.get(pmid) ?? 999,
    }];
  });
}

async function searchPubMedIds(query, { fetchImpl, signal, limit }) {
  const params = pubmedParams({ db: "pubmed", retmode: "json", retmax: String(limit), sort: "relevance", term: query });
  const response = await fetchImpl(`${PUBMED_EUTILS}/esearch.fcgi?${params}`, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) return [];
  const payload = await response.json();
  return Array.isArray(payload?.esearchresult?.idlist) ? payload.esearchresult.idlist : [];
}

export async function fetchPubMedSources(query, { fetchImpl = fetch, signal, limit = 5 } = {}) {
  const cleaned = cleanText(query, 500);
  if (!cleaned) return [];
  let ids = await searchPubMedIds(buildPreferredPubMedQuery(cleaned), { fetchImpl, signal, limit });
  if (!ids.length) ids = await searchPubMedIds(cleaned, { fetchImpl, signal, limit });
  if (!ids.length) return [];
  const params = pubmedParams({ db: "pubmed", retmode: "xml", id: ids.join(",") });
  const response = await fetchImpl(`${PUBMED_EUTILS}/efetch.fcgi?${params}`, { signal, headers: { Accept: "application/xml,text/xml" } });
  if (!response.ok) return [];
  return dedupeAndRankSources(parsePubMedXml(await response.text(), ids), limit);
}

export async function fetchOfficialSearchSources(query, { apiKey, fetchImpl = fetch, signal, limit = 4, endpoint = STEPFUN_SEARCH } = {}) {
  const cleaned = cleanText(query, 500);
  if (!cleaned || !apiKey) return [];
  const response = await fetchImpl(endpoint, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ query: cleaned, n: Math.min(8, Math.max(1, limit)), category: "gov" }),
  });
  if (!response.ok) return [];
  const payload = await response.json();
  const sources = Array.isArray(payload?.results) ? payload.results : [];
  return dedupeAndRankSources(sources.flatMap((item) => {
    if (!isTrustedOfficialUrl(item?.url)) return [];
    return [{
      title: item.title,
      publisherOrAuthors: new URL(normalizeSourceUrl(item.url)).hostname,
      publishedAt: item.time || null,
      url: item.url,
      doi: null,
      journal: null,
      supportingExcerpt: item.content || item.snippet,
      populationOrContext: null,
      limitations: "网页资料需结合页面的适用人群、发布时间与更新状态理解。",
      sourceType: "official guidance",
      origin: "official_search",
    }];
  }), limit);
}

export function publicSource(source) {
  return {
    title: source.title,
    publisherOrAuthors: source.publisherOrAuthors,
    publishedAt: source.publishedAt,
    url: source.url,
  };
}
