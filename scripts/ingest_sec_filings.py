#!/usr/bin/env python3
"""
Step 1: Ingest SEC 10-K filings into Haystack document store.

For ALL tickers in coverage_gap_scores:
  - 1 most recent 10-K (annual report)
  - Max 15 chunks per filing (keeps important sections, drops noise)

Downloads HTML from SEC EDGAR, extracts text, tags sections,
chunks, embeds with BAAI/bge-small-en-v1.5 (local, free),
and writes to Haystack's PgvectorDocumentStore.

Tracks ingested filings in `sec_documents` table to avoid re-processing.
Safe to stop (Ctrl+C) and re-run — skips already-ingested filings.

Expected storage: ~1,700 tickers × 15 chunks × ~5KB = ~125 MB

Usage:
  python scripts/ingest_sec_filings.py

Env (.env.local):
  SUPABASE_URL, SUPABASE_ANON_KEY, SEC_USER_AGENT, PG_CONN_STRING

Optional env:
  SKIP_EXISTING=1   Skip filings already in sec_documents (default 1)
"""

import os
os.environ["USE_TF"] = "0"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import sys
import re
import time
import pathlib
from typing import Dict, List, Optional, Tuple

import requests
import numpy as np
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from supabase import create_client, Client

# --- Path setup ---
_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_script_dir)
sys.path.insert(0, _project_root)
load_dotenv(os.path.join(_project_root, ".env.local"))

# --- Config ---
SKIP_EXISTING = os.getenv("SKIP_EXISTING", "1").strip().lower() in ("1", "true", "yes")

# Filing limits per ticker — 10-K only
LIMITS = {
    "10-K": 1,
}

# Max chunks to keep per filing (first 15 cover Business, Risk Factors, MD&A)
MAX_CHUNKS_PER_FILING = 15

# SEC EDGAR URLs
SEC_SUBMISSIONS = "https://data.sec.gov/submissions/CIK{cik}.json"
SEC_ARCHIVES = "https://www.sec.gov/Archives/edgar/data/{cik}/{acc_no}/{primary_doc}"
SEC_TICKERS = "https://www.sec.gov/files/company_tickers.json"

# SEC rate limit: max 10 requests/sec, we stay well under
SEC_DELAY = 0.15


# ======================================================================
# SUPABASE SETUP
# ======================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.local")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_sec_user_agent() -> str:
    ua = os.getenv("SEC_USER_AGENT")
    if not ua:
        raise RuntimeError(
            "SEC_USER_AGENT must be set in .env.local "
            "(e.g. 'Your Name youremail@example.com')"
        )
    return ua


# ======================================================================
# PART 1: Get all scored tickers and resolve CIKs
# ======================================================================

def get_all_scored_tickers() -> List[str]:
    """Fetch ALL tickers from coverage_gap_scores, ordered by gap_score desc."""
    all_data = []
    page_size = 1000
    offset = 0
    while True:
        r = (
            supabase.table("coverage_gap_scores")
            .select("ticker")
            .order("gap_score", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        data = r.data or []
        all_data.extend(data)
        if len(data) < page_size:
            break
        offset += page_size
    return [row["ticker"] for row in all_data]


def ticker_to_cik(tickers: List[str], ua: str) -> Dict[str, str]:
    """Resolve ticker -> CIK from SEC company_tickers.json."""
    out: Dict[str, str] = {}
    if not tickers:
        return out
    ticker_set = set(tickers)
    resp = requests.get(SEC_TICKERS, headers={"User-Agent": ua}, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    for entry in data.values():
        t = entry.get("ticker")
        if t in ticker_set:
            out[t] = str(entry["cik_str"]).zfill(10)
    return out


# ======================================================================
# PART 2: Fetch filings from SEC EDGAR
# ======================================================================

def fetch_submissions(cik: str, ua: str) -> dict:
    url = SEC_SUBMISSIONS.format(cik=cik)
    resp = requests.get(url, headers={"User-Agent": ua}, timeout=15)
    resp.raise_for_status()
    return resp.json()


def list_recent_filings(data: dict) -> List[dict]:
    """Parse all recent filings from SEC submissions response."""
    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])
    primary_docs = recent.get("primaryDocument", [])
    filings = []
    for form, d, acc, doc in zip(forms, dates, accessions, primary_docs):
        filings.append({
            "form": form,
            "date": d,
            "accession": acc,
            "primary_doc": doc,
        })
    return filings


def select_filings(filings: List[dict]) -> List[dict]:
    """
    From all filings, select the most recent 10-K only.
    Filings are already in reverse chronological order from SEC.
    """
    selected = []
    counts = {"10-K": 0}

    for f in filings:
        form = f["form"]
        if form in counts and counts[form] < LIMITS[form]:
            selected.append(f)
            counts[form] += 1

        if all(counts[k] >= LIMITS[k] for k in counts):
            break

    return selected


def build_filing_url(cik: str, accession: str, primary_doc: str) -> str:
    cik_clean = str(int(cik))
    acc_clean = accession.replace("-", "")
    return SEC_ARCHIVES.format(cik=cik_clean, acc_no=acc_clean, primary_doc=primary_doc)


def download_filing_html(cik: str, filing: dict, ua: str) -> Tuple[str, str]:
    """Download filing HTML. Returns (html_content, source_url)."""
    url = build_filing_url(cik, filing["accession"], filing["primary_doc"])
    resp = requests.get(url, headers={"User-Agent": ua}, timeout=60)
    resp.raise_for_status()
    return resp.text, url


# ======================================================================
# PART 3: HTML to text + section tagging
# ======================================================================

def html_to_text(html: str) -> str:
    """Extract plain text from SEC HTML using BeautifulSoup."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = soup.get_text(separator="\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def tag_section_10k(chunk_text: str) -> str:
    """Tag a chunk from a 10-K based on section headers in the text."""
    text_lower = chunk_text.lower()

    if "risk factor" in text_lower:
        return "risk_factors"
    elif "management's discussion" in text_lower or "md&a" in text_lower:
        return "mdna"
    elif "business" in text_lower and len(text_lower) < 3000:
        if any(phrase in text_lower for phrase in [
            "our business", "overview of the business", "description of business",
            "item 1.", "item 1 ", "business overview"
        ]):
            return "business_overview"
    elif "financial statement" in text_lower or "balance sheet" in text_lower:
        return "financials"
    elif "legal proceeding" in text_lower:
        return "legal"

    return "general"


# ======================================================================
# PART 4: Chunking
# ======================================================================

def chunk_text(text: str) -> List[str]:
    """Split text into chunks using LangChain's RecursiveCharacterTextSplitter."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200,
        chunk_overlap=200,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(text)


# ======================================================================
# PART 5: Embedding (local, free)
# ======================================================================

_embed_model = None

def get_embed_model():
    """Load embedding model once and cache it."""
    global _embed_model
    if _embed_model is None:
        from sentence_transformers import SentenceTransformer
        print("Loading embedding model: BAAI/bge-small-en-v1.5 (384 dims)...")
        _embed_model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    return _embed_model


def embed_chunks(texts: List[str]) -> np.ndarray:
    """Embed a list of texts locally. Returns numpy array of shape (n, 384)."""
    model = get_embed_model()
    embeddings = model.encode(
        texts,
        show_progress_bar=False,
        normalize_embeddings=True,
        batch_size=64,
    )
    return embeddings


# ======================================================================
# PART 6: Tracking (sec_documents table)
# ======================================================================

def get_existing_filings() -> set:
    """Get set of (ticker, form_type, filing_date) already ingested."""
    existing = set()
    page_size = 1000
    offset = 0
    while True:
        r = (
            supabase.table("sec_documents")
            .select("ticker, form_type, filing_date")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        data = r.data or []
        for row in data:
            existing.add((row["ticker"], row["form_type"], row["filing_date"]))
        if len(data) < page_size:
            break
        offset += page_size
    return existing


def track_document(ticker: str, form_type: str, filing_date: str,
                   source_url: str, chunk_count: int) -> None:
    """Upsert a row into sec_documents to track this filing."""
    row = {
        "ticker": ticker,
        "form_type": form_type,
        "filing_date": filing_date,
        "source_url": source_url,
        "title": f"{ticker} {form_type} {filing_date}",
        "chunk_count": chunk_count,
    }
    supabase.table("sec_documents").upsert(
        row, on_conflict="ticker,form_type,filing_date"
    ).execute()


# ======================================================================
# PART 7: Write to Haystack document store
# ======================================================================

def write_filing_chunks(ticker: str, form_type: str, filing_date: str,
                        chunks: List[str], embeddings: np.ndarray) -> int:
    """Write chunks for one filing to Haystack document store. Returns count written."""
    from rag.document_store import get_document_store
    from haystack import Document
    from haystack.document_stores.types import DuplicatePolicy

    store = get_document_store()

    documents = []
    for i, (text, emb) in enumerate(zip(chunks, embeddings)):
        section = tag_section_10k(text)
        doc = Document(
            content=text,
            embedding=emb.tolist(),
            meta={
                "ticker": ticker,
                "source_type": "sec_filing",
                "form_type": form_type,
                "section": section,
                "filing_date": filing_date,
                "chunk_index": i,
            }
        )
        documents.append(doc)

    store.write_documents(documents, policy=DuplicatePolicy.OVERWRITE)
    return len(documents)


# ======================================================================
# PART 8: Main pipeline
# ======================================================================

def main() -> None:
    start = time.time()
    print("=" * 60)
    print("STEP 1: Ingest SEC 10-K Filings")
    print(f"  All tickers from coverage_gap_scores")
    print(f"  Per ticker: {LIMITS['10-K']} 10-K only (max {MAX_CHUNKS_PER_FILING} chunks)")
    print(f"  Skip existing: {SKIP_EXISTING}")
    print("=" * 60 + "\n")

    ua = get_sec_user_agent()

    # --- Get all scored tickers ---
    print("Fetching all tickers from coverage_gap_scores...")
    tickers = get_all_scored_tickers()
    if not tickers:
        print("❌ No tickers in coverage_gap_scores. Run daily pipeline first.")
        return
    print(f"  Got {len(tickers)} tickers\n")

    # --- Resolve CIKs ---
    print("Resolving CIKs from SEC...")
    cik_map = ticker_to_cik(tickers, ua)
    no_cik = [t for t in tickers if t not in cik_map]
    if no_cik:
        print(f"  ⚠️  No CIK for {len(no_cik)} tickers: {no_cik[:10]}...")
    tickers = [t for t in tickers if t in cik_map]
    print(f"  {len(tickers)} tickers with CIK resolved\n")

    if not tickers:
        print("❌ No tickers with CIK. Exiting.")
        return

    # --- Load existing filings to skip ---
    existing = set()
    if SKIP_EXISTING:
        print("Loading already-ingested filings...")
        existing = get_existing_filings()
        print(f"  {len(existing)} filings already in sec_documents\n")

    # --- Load embedding model upfront ---
    get_embed_model()
    print()

    # --- Process each ticker ---
    total_docs = 0
    total_chunks = 0
    total_skipped = 0
    total_errors = 0

    for idx, ticker in enumerate(tickers):
        cik = cik_map[ticker]
        print(f"[{idx + 1}/{len(tickers)}] {ticker} (CIK {cik})")

        # Fetch submissions
        try:
            data = fetch_submissions(cik, ua)
            time.sleep(SEC_DELAY)
        except Exception as e:
            print(f"  ❌ submissions error: {e}")
            total_errors += 1
            continue

        # Select filings (1 10-K only)
        all_filings = list_recent_filings(data)
        selected = select_filings(all_filings)

        if not selected:
            print(f"  No 10-K filing found")
            continue

        print(f"  Found: 10-K")

        ticker_filed = 0
        for filing in selected:
            form = filing["form"]
            fd = filing["date"]
            filing_key = (ticker, form, fd)

            # Skip if already ingested
            if SKIP_EXISTING and filing_key in existing:
                total_skipped += 1
                continue

            # Download HTML
            try:
                html, source_url = download_filing_html(cik, filing, ua)
                time.sleep(SEC_DELAY)
            except Exception as e:
                print(f"  ❌ {form} {fd}: download error — {e}")
                total_errors += 1
                continue

            # HTML → text
            text = html_to_text(html)
            if len(text) < 300:
                print(f"  ⚠️  {form} {fd}: too little text ({len(text)} chars), skip")
                total_skipped += 1
                continue

            # Chunk (capped to keep storage manageable)
            chunks = chunk_text(text)[:MAX_CHUNKS_PER_FILING]
            if not chunks:
                print(f"  ⚠️  {form} {fd}: no chunks generated, skip")
                total_skipped += 1
                continue

            # Embed
            try:
                embeddings = embed_chunks(chunks)
            except Exception as e:
                print(f"  ❌ {form} {fd}: embedding error — {e}")
                total_errors += 1
                continue

            # Write to Haystack
            try:
                count = write_filing_chunks(ticker, form, fd, chunks, embeddings)
            except Exception as e:
                print(f"  ❌ {form} {fd}: document store error — {e}")
                total_errors += 1
                continue

            # Track in sec_documents
            try:
                track_document(ticker, form, fd, source_url, count)
            except Exception as e:
                print(f"  ⚠️  {form} {fd}: tracking error (chunks already written) — {e}")

            total_docs += 1
            total_chunks += count
            ticker_filed += 1
            print(f"  ✅ 10-K {fd}: {count} chunks (capped at {MAX_CHUNKS_PER_FILING})")

        if ticker_filed == 0 and total_skipped > 0:
            print(f"  (already ingested)")

        # Small pause between tickers to be nice to SEC
        time.sleep(0.3)

        # Progress update every 50 tickers
        if (idx + 1) % 50 == 0:
            elapsed = time.time() - start
            rate = (idx + 1) / elapsed * 60
            remaining = (len(tickers) - idx - 1) / rate if rate > 0 else 0
            print(f"\n  --- Progress: {idx + 1}/{len(tickers)} tickers | "
                  f"{total_docs} docs | {total_chunks} chunks | "
                  f"{elapsed:.0f}s elapsed | ~{remaining:.0f}min remaining ---\n")

    # --- Summary ---
    elapsed = time.time() - start
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Tickers processed: {len(tickers)}")
    print(f"  10-K filings ingested: {total_docs}")
    print(f"  Chunks written:    {total_chunks} (max {MAX_CHUNKS_PER_FILING} per filing)")
    print(f"  Filings skipped:   {total_skipped} (already ingested)")
    print(f"  Errors:            {total_errors}")
    print(f"  Time:              {elapsed:.0f}s ({elapsed/60:.1f}min)")
    print("=" * 60)

    # --- Final count in document store ---
    try:
        from rag.document_store import get_document_store
        store = get_document_store()
        final_count = store.count_documents()
        print(f"\n  Total documents in haystack_documents: {final_count}")
        print(f"    ({total_chunks} SEC chunks + stock profiles)")
    except Exception:
        pass

    print(f"\n✅ Done!")


if __name__ == "__main__":
    main()