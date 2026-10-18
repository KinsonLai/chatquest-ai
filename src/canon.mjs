import { createHash } from "node:crypto";
import { fail } from "./schema.mjs";
export const sha = (value) =>
  createHash("sha256")
    .update(
      typeof value === "string" ? value : JSON.stringify(canonical(value)),
    )
    .digest("hex");
export const canonical = (v) =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
function tokens(text) {
  const normalized = text.normalize("NFKC").toLowerCase();
  const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  const grams = [
    ...(normalized.match(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu,
    ) ?? []),
  ].flatMap((s) => {
    const c = Array.from(s);
    return c.length === 1 ? c : c.slice(0, -1).map((v, i) => v + c[i + 1]);
  });
  return [...new Set([...words, ...grams])].slice(0, 20000);
}
export function ingest(store, campaign, documents) {
  let count = 0;
  for (const doc of documents) {
    const hash = sha(doc.text),
      old = store.get(
        "SELECT hash FROM sources WHERE campaign=? AND id=?",
        campaign,
        doc.id,
      );
    if (old) {
      if (old.hash !== hash)
        fail(
          "CANON_IMMUTABLE",
          "A source ID cannot change its text; use a new source ID for a new edition.",
        );
      continue;
    }
    store.run(
      "INSERT INTO sources VALUES(?,?,?,?)",
      campaign,
      doc.id,
      doc.title,
      hash,
    );
    const lines = doc.text.replace(/\r\n?/g, "\n").split("\n");
    let start = 0,
      part = [],
      size = 0;
    const flush = (end) => {
      if (!part.length) return;
      const text = part.join("\n"),
        id = sha([campaign, doc.id, hash, start, end]).slice(0, 40),
        citation = `${doc.id}@${hash}:L${start + 1}-L${end + 1}`;
      store.run(
        "INSERT INTO chunks VALUES(?,?,?,?,?,?)",
        id,
        campaign,
        doc.id,
        doc.title,
        text,
        citation,
      );
      store.run(
        "INSERT INTO canon_fts(chunk_id,campaign,body) VALUES(?,?,?)",
        id,
        campaign,
        tokens(text).join(" "),
      );
      count++;
      part = [];
      size = 0;
    };
    for (let i = 0; i < lines.length; i++) {
      if (size + lines[i].length > 1400 && part.length) {
        flush(i - 1);
        start = i;
      }
      part.push(lines[i]);
      size += lines[i].length + 1;
    }
    flush(lines.length - 1);
  }
  return { chunks_added: count, sources: documents.map((d) => d.id) };
}
export function search(store, campaign, query, limit) {
  const terms = tokens(query).slice(0, 32);
  if (!terms.length)
    return { hits: [], note: "No searchable terms; try concrete words." };
  const match = terms
    .map((t) => '"' + t.replaceAll('"', '""') + '"')
    .join(" OR ");
  const hits = store
    .all(
      "SELECT c.*,bm25(canon_fts) AS rank FROM canon_fts JOIN chunks c ON c.id=canon_fts.chunk_id WHERE canon_fts MATCH ? AND c.campaign=? ORDER BY rank,c.id LIMIT ?",
      match,
      campaign,
      limit,
    )
    .map(({ campaign, source, ...r }) => r);
  return {
    hits,
    method:
      "FTS5/BM25 with Unicode words and CJK bigrams; lexical, not neural embeddings",
    note: "Read citations before using them. Retrieved secrets are not automatically known to characters.",
  };
}
