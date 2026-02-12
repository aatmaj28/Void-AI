#!/usr/bin/env python3
"""
Phase 4 RAG: Ingest SEC 10-K/10-Q for top 50 tickers by gap_score.

- Fetches top 50 tickers from Supabase (coverage_gap_scores).
- Resolves CIK from companies table or SEC company_tickers.json.
- Downloads latest 10-K and 10-Q HTML per ticker (same logic as test_sec_fetch).
- Extracts text with BeautifulSoup (default) or Jina AI Reader (optional).
- Chunks with LangChain RecursiveCharacterTextSplitter, embeds with Mistral, upserts to DB.

Usage:
  python scripts/ingest_sec_filings.py

Env (.env.local):
  SUPABASE_URL, SUPABASE_ANON_KEY, SEC_USER_AGENT, MISTRAL_API_KEY
  Optional: USE_JINA_READER=1 to use Jina AI Reader for HTML→text; JINA_READER_API_KEY for higher limits.
"""

import os
import pathlib
import re
import time
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from supabase import create_client, Client

# --- SEC (reuse test_sec_fetch logic) ---
SEC_SUBMISSIONS = "https://data.sec.gov/submissions/CIK{cik}.json"
SEC_ARCHIVES = "https://www.sec.gov/Archives/edgar/data/{cik}/{acc_no}/{primary_doc}"
SEC_TICKERS = "https://www.sec.gov/files/company_tickers.json"
FORMS = {"10-K", "10-Q"}

# --- Jina AI Reader (optional HTML→text) ---
JINA_READER_URL = "https://r.jina.ai/"

# --- Mistral ---
MISTRAL_EMBED_URL = "https://api.mistral.ai/v1/embeddings"
MISTRAL_EMBED_MODEL = "mistral-embed"
EMBED_BATCH_SIZE = 20


def load_env() -> None:
    root = pathlib.Path(__file__).resolve().parent.parent
    env = root / ".env.local"
    if env.exists():
        load_dotenv(env)


def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env.local")
    return create_client(url, key)


def get_sec_user_agent() -> str:
    ua = os.getenv("SEC_USER_AGENT")
    if not ua:
        raise RuntimeError("SEC_USER_AGENT must be set in .env.local (e.g. 'Name email@example.com')")
    return ua


def get_mistral_key() -> str:
    key = os.getenv("MISTRAL_API_KEY")
    if not key:
        raise RuntimeError("MISTRAL_API_KEY must be set in .env.local for embeddings")
    return key


def top_tickers(supabase: Client, limit: int = 50) -> List[str]:
    r = (
        supabase.table("coverage_gap_scores")
        .select("ticker")
        .order("gap_score", desc=True)
        .limit(limit)
        .execute()
    )
    return [row["ticker"] for row in (r.data or [])]


def ticker_to_cik(supabase: Client, tickers: List[str], ua: str) -> Dict[str, str]:
    """Resolve ticker -> CIK from SEC company_tickers.json."""
    out: Dict[str, str] = {}
    if not tickers:
        return out

    resp = requests.get(SEC_TICKERS, headers={"User-Agent": ua}, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    for entry in data.values():
        t = entry.get("ticker")
        if t in tickers:
            out[t] = str(entry["cik_str"]).zfill(10)
    return out


def fetch_submissions(cik: str, ua: str) -> dict:
    url = SEC_SUBMISSIONS.format(cik=cik)
    resp = requests.get(url, headers={"User-Agent": ua}, timeout=15)
    resp.raise_for_status()
    return resp.json()


def list_recent_filings(data: dict) -> List[dict]:
    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])
    primary_docs = recent.get("primaryDocument", [])
    filings = []
    for form, d, acc, doc in zip(forms, dates, accessions, primary_docs):
        filings.append({"form": form, "date": d, "accession": acc, "primary_doc": doc})
    return filings


def build_filing_url(cik: str, accession: str, primary_doc: str) -> str:
    cik_clean = str(int(cik))
    acc_clean = accession.replace("-", "")
    return SEC_ARCHIVES.format(cik=cik_clean, acc_no=acc_clean, primary_doc=primary_doc)


def download_filing_html(cik: str, filing: dict, ua: str) -> Tuple[str, str]:
    """Returns (html_content, source_url)."""
    url = build_filing_url(cik, filing["accession"], filing["primary_doc"])
    resp = requests.get(url, headers={"User-Agent": ua}, timeout=60)
    resp.raise_for_status()
    return resp.text, url


def _html_to_text_bs4(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = soup.get_text(separator="\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _html_to_text_jina(html: str, api_key: Optional[str] = None) -> str:
    """Use Jina AI Reader to convert HTML to clean text (LLM-friendly)."""
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    resp = requests.post(
        JINA_READER_URL,
        headers=headers,
        json={"html": html, "respondWith": "text"},
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    text = (data.get("data") or "").strip()
    return text


def html_to_text(html: str) -> str:
    """Extract plain text from SEC HTML. Uses Jina AI Reader if USE_JINA_READER=1 else BeautifulSoup."""
    use_jina = os.getenv("USE_JINA_READER", "").strip().lower() in ("1", "true", "yes")
    if use_jina:
        api_key = os.getenv("JINA_READER_API_KEY") or None
        return _html_to_text_jina(html, api_key)
    return _html_to_text_bs4(html)


def chunk_text(text: str) -> List[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200,
        chunk_overlap=200,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(text)


def get_embeddings(texts: List[str], api_key: str) -> List[List[float]]:
    """Call Mistral embeddings API in batches. Returns list of vectors (1024 dims)."""
    results: List[List[float]] = []
    for i in range(0, len(texts), EMBED_BATCH_SIZE):
        batch = texts[i : i + EMBED_BATCH_SIZE]
        payload = {"model": MISTRAL_EMBED_MODEL, "input": batch}
        resp = requests.post(
            MISTRAL_EMBED_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        # Preserve order by index
        out = [None] * len(batch)
        for item in data.get("data", []):
            idx = item.get("index", len(out) - 1)
            out[idx] = item["embedding"]
        results.extend(out)
        time.sleep(0.2)
    return results


def upsert_document(
    supabase: Client,
    ticker: str,
    form_type: str,
    filing_date: str,
    source_url: str,
    title: Optional[str],
) -> str:
    """Upsert sec_documents row; return document id."""
    row: Dict[str, Any] = {
        "ticker": ticker,
        "form_type": form_type,
        "filing_date": filing_date,
        "source_url": source_url,
        "title": title or f"{ticker} {form_type} {filing_date}",
    }
    r = (
        supabase.table("sec_documents")
        .upsert(row, on_conflict="ticker,form_type,filing_date")
        .select("id")
        .execute()
    )
    if not r.data or len(r.data) == 0:
        # Fallback: select by natural key
        r = (
            supabase.table("sec_documents")
            .select("id")
            .eq("ticker", ticker)
            .eq("form_type", form_type)
            .eq("filing_date", filing_date)
            .limit(1)
            .execute()
        )
    return r.data[0]["id"]


def delete_chunks(supabase: Client, document_id: str) -> None:
    supabase.table("sec_chunks").delete().eq("document_id", document_id).execute()


def insert_chunks(supabase: Client, document_id: str, chunks: List[str], embeddings: List[List[float]]) -> None:
    if len(chunks) != len(embeddings):
        raise ValueError("chunks and embeddings length mismatch")
    rows = [
        {"document_id": document_id, "chunk_index": i, "content": c, "embedding": e}
        for i, (c, e) in enumerate(zip(chunks, embeddings))
    ]
    supabase.table("sec_chunks").insert(rows).execute()


def main() -> None:
    load_env()
    supabase = get_supabase()
    ua = get_sec_user_agent()
    mistral_key = get_mistral_key()

    tickers = top_tickers(supabase, 50)
    if not tickers:
        print("No tickers in coverage_gap_scores. Run pipeline first.")
        return
    print(f"Top {len(tickers)} tickers by gap_score: {tickers[:10]}...")

    cik_map = ticker_to_cik(supabase, tickers, ua)
    for t in tickers:
        if t not in cik_map:
            print(f"  Skip {t}: no CIK")
    tickers = [t for t in tickers if t in cik_map]
    if not tickers:
        print("No tickers with CIK.")
        return

    total_docs = 0
    total_chunks = 0
    for ticker in tickers:
        cik = cik_map[ticker]
        try:
            data = fetch_submissions(cik, ua)
            filings = list_recent_filings(data)
            sec_filings = [f for f in filings if f["form"] in FORMS][:2]
        except Exception as e:
            print(f"  {ticker}: submissions error — {e}")
            continue

        for filing in sec_filings:
            form = filing["form"]
            fd = filing["date"]
            try:
                html, source_url = download_filing_html(cik, filing, ua)
            except Exception as e:
                print(f"  {ticker} {form} {fd}: download error — {e}")
                continue
            text = html_to_text(html)
            if len(text) < 500:
                print(f"  {ticker} {form} {fd}: too little text ({len(text)} chars), skip")
                continue
            chunks = chunk_text(text)
            if not chunks:
                continue
            try:
                embeddings = get_embeddings(chunks, mistral_key)
            except Exception as e:
                print(f"  {ticker} {form} {fd}: embeddings error — {e}")
                continue
            try:
                doc_id = upsert_document(supabase, ticker, form, fd, source_url, None)
                delete_chunks(supabase, doc_id)
                insert_chunks(supabase, doc_id, chunks, embeddings)
            except Exception as e:
                print(f"  {ticker} {form} {fd}: db error — {e}")
                continue
            total_docs += 1
            total_chunks += len(chunks)
            print(f"  {ticker} {form} {fd}: {len(chunks)} chunks")
        time.sleep(0.5)

    print(f"\nDone. Documents: {total_docs}, Chunks: {total_chunks}")


if __name__ == "__main__":
    main()
