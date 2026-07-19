import assert from "node:assert/strict";
import test from "node:test";
import {
  PREFERRED_JOURNALS,
  buildPreferredPubMedQuery,
  dedupeAndRankSources,
  fetchOfficialSearchSources,
  fetchPubMedSources,
  normalizeSourceUrl,
} from "./professionalSources.js";

test("the owner-selected journal registry is deduplicated and becomes a PubMed priority query", () => {
  assert.equal(new Set(PREFERRED_JOURNALS).size, PREFERRED_JOURNALS.length);
  const query = buildPreferredPubMedQuery("dysmenorrhea functional impairment");
  PREFERRED_JOURNALS.forEach((journal) => assert.ok(query.includes(`\"${journal}\"[jour]`), `missing preferred journal: ${journal}`));
});

test("PubMed discovery returns an actual PubMed link and falls back when preferred journals are empty", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes("esearch.fcgi")) {
      const preferred = /Human(?:\+| )Reproduction(?:\+| )Update/.test(decodeURIComponent(String(url)));
      return new Response(JSON.stringify({ esearchresult: { idlist: preferred ? [] : ["123"] } }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(`<?xml version="1.0"?><PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>123</PMID><Article><ArticleTitle>Menstrual pain and daily function</ArticleTitle><Abstract><AbstractText>Menstrual pain can affect daily functioning in the studied population.</AbstractText></Abstract><Journal><Title>Pain</Title><JournalIssue><PubDate><Year>2025</Year></PubDate></JournalIssue></Journal><AuthorList><Author><LastName>Li</LastName><Initials>Y</Initials></Author></AuthorList></Article></MedlineCitation><PubmedData><ArticleIdList><ArticleId IdType="doi">10.1000/example</ArticleId></ArticleIdList></PubmedData></PubmedArticle></PubmedArticleSet>`, { status: 200, headers: { "Content-Type": "application/xml" } });
  };
  const sources = await fetchPubMedSources("dysmenorrhea", { fetchImpl, limit: 3 });
  assert.equal(calls.filter((url) => url.includes("esearch.fcgi")).length, 2);
  assert.equal(sources[0].url, "https://pubmed.ncbi.nlm.nih.gov/123/");
  assert.equal(sources[0].journal, "Pain");
  assert.match(sources[0].supportingExcerpt, /daily functioning/);
});

test("source normalization rejects unsafe protocols and deduplicates by canonical URL or DOI", () => {
  assert.equal(normalizeSourceUrl("javascript:alert(1)"), null);
  const sources = dedupeAndRankSources([
    { title: "A", publisherOrAuthors: "Pain", url: "https://pubmed.ncbi.nlm.nih.gov/1/?utm_source=x", doi: "10.1/A", supportingExcerpt: "short excerpt", origin: "pubmed" },
    { title: "A complete", publisherOrAuthors: "Pain", url: "https://pubmed.ncbi.nlm.nih.gov/1/", doi: "10.1/a", supportingExcerpt: "a longer and more useful abstract excerpt", origin: "pubmed" },
    { title: "Unsafe", publisherOrAuthors: "", url: "javascript:alert(1)", supportingExcerpt: "bad" },
  ]);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].title, "A complete");
});

test("official search keeps only trusted official domains and accepts an injected endpoint", async () => {
  let usedEndpoint = null;
  const fetchImpl = async (url) => {
    usedEndpoint = url;
    return new Response(JSON.stringify({ results: [
      { title: "NICE guidance", url: "https://www.nice.org.uk/guidance/example", content: "Official guidance content", time: "2025" },
      { title: "Marketing post", url: "https://example.com/sell", content: "Buy now", time: "2025" },
    ] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const sources = await fetchOfficialSearchSources("heavy menstrual bleeding guidance", { apiKey: "test", fetchImpl, endpoint: "https://search.test/v1/search" });
  assert.equal(usedEndpoint, "https://search.test/v1/search");
  assert.equal(sources.length, 1);
  assert.equal(new URL(sources[0].url).hostname, "www.nice.org.uk");
});

test("PubMed relevance order is preserved inside the preferred-journal lane", async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes("esearch.fcgi")) return new Response(JSON.stringify({ esearchresult: { idlist: ["2", "1"] } }), { status: 200 });
    return new Response(`<?xml version="1.0"?><PubmedArticleSet>
      <PubmedArticle><MedlineCitation><PMID>1</PMID><Article><ArticleTitle>Later result</ArticleTitle><Abstract><AbstractText>Later abstract</AbstractText></Abstract><Journal><Title>Human Reproduction Update</Title></Journal></Article></MedlineCitation></PubmedArticle>
      <PubmedArticle><MedlineCitation><PMID>2</PMID><Article><ArticleTitle>Most relevant result</ArticleTitle><Abstract><AbstractText>Most relevant abstract</AbstractText></Abstract><Journal><Title>BMC Women's Health</Title></Journal></Article></MedlineCitation></PubmedArticle>
    </PubmedArticleSet>`, { status: 200 });
  };
  const sources = await fetchPubMedSources("dysmenorrhea function", { fetchImpl, limit: 2 });
  assert.equal(sources[0].url, "https://pubmed.ncbi.nlm.nih.gov/2/");
  assert.equal(sources[1].url, "https://pubmed.ncbi.nlm.nih.gov/1/");
});
