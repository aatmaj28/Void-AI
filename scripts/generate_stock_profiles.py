#!/usr/bin/env python3
"""
Step 2: Generate natural language stock profiles from structured data.

Reads companies, coverage_gap_scores, analyst_coverage, and stock_metrics
from Supabase, converts each ticker's numbers into two readable text chunks,
embeds them with BAAI/bge-small-en-v1.5, and stores in Haystack's pgvector
document store.

Usage:
  python scripts/generate_stock_profiles.py

Requires:
  - PG_CONN_STRING, SUPABASE_URL, SUPABASE_ANON_KEY in .env.local
  - pip install haystack-ai pgvector-haystack sentence-transformers
"""

import os
os.environ["USE_TF"] = "0"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import sys
import time
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# --- Path setup ---
_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_script_dir)
sys.path.insert(0, _project_root)
load_dotenv(os.path.join(_project_root, ".env.local"))

# --- Supabase setup ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.local")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ======================================================================
# PART 1: Fetch all data from Supabase (with pagination)
# ======================================================================

def fetch_all(table_name, select_query="*"):
    """Fetch all rows from a Supabase table using pagination."""
    all_data = []
    page_size = 1000
    offset = 0
    while True:
        res = (
            supabase.table(table_name)
            .select(select_query)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        data = res.data or []
        all_data.extend(data)
        if len(data) < page_size:
            break
        offset += page_size
    return pd.DataFrame(all_data)


def fetch_and_merge():
    """Fetch all four tables and merge on ticker."""
    print("Fetching data from Supabase...")

    companies = fetch_all(
        "companies",
        "ticker, name, sector, industry, market_cap, cap_type"
    )
    print(f"  companies: {len(companies)} rows")

    scores = fetch_all(
        "coverage_gap_scores",
        "ticker, coverage_score, activity_score, quality_score, gap_score, opportunity_type, confidence"
    )
    print(f"  coverage_gap_scores: {len(scores)} rows")

    coverage = fetch_all(
        "analyst_coverage",
        "ticker, analyst_count, recommendation_key, recommendation_mean, target_mean_price, target_high_price, target_low_price"
    )
    print(f"  analyst_coverage: {len(coverage)} rows")

    metrics = fetch_all(
        "stock_metrics",
        "ticker, avg_volume_20d, volatility_20d, price_change_1m, price_change_3m, current_price, year_high, year_low"
    )
    print(f"  stock_metrics: {len(metrics)} rows")

    # Inner join all four on ticker
    df = (
        companies
        .merge(scores, on="ticker", how="inner")
        .merge(coverage, on="ticker", how="inner")
        .merge(metrics, on="ticker", how="inner")
    )
    print(f"  Merged: {len(df)} tickers\n")
    return df


# ======================================================================
# PART 2: Formatting helpers
# ======================================================================

def format_market_cap(value):
    """Convert market cap number to human readable string."""
    if value is None or (isinstance(value, float) and np.isnan(value)) or value == 0:
        return "N/A"
    value = float(value)
    if value >= 1e12:
        return f"${value / 1e12:.1f}T"
    elif value >= 1e9:
        return f"${value / 1e9:.1f}B"
    elif value >= 1e6:
        return f"${value / 1e6:.0f}M"
    else:
        return f"${value:,.0f}"


def format_volume(value):
    """Format volume with commas."""
    if value is None or (isinstance(value, float) and np.isnan(value)) or value == 0:
        return "N/A"
    return f"{int(value):,}"


def format_price(value):
    """Format price with dollar sign and 2 decimals."""
    if value is None or (isinstance(value, float) and np.isnan(value)) or value == 0:
        return "N/A"
    return f"${float(value):.2f}"


def format_pct(value):
    """Format percentage with sign."""
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "N/A"
    value = float(value)
    sign = "+" if value >= 0 else ""
    return f"{sign}{value:.1f}%"


def format_score(value):
    """Format score as integer out of 100."""
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "N/A"
    return f"{int(round(float(value)))}"


def safe_str(value, default="N/A"):
    """Safely convert to string, handling None and NaN."""
    if value is None:
        return default
    if isinstance(value, float) and np.isnan(value):
        return default
    return str(value)


# ======================================================================
# PART 3: Generate text chunks per ticker
# ======================================================================

def generate_chunks_for_ticker(row):
    """
    Generate two text chunks for a single ticker.
    Returns list of (text, section_name) tuples.
    """
    ticker = row["ticker"]
    name = safe_str(row.get("name"), ticker)
    sector = safe_str(row.get("sector"), "Unknown")
    industry = safe_str(row.get("industry"), "Unknown")
    cap_type = safe_str(row.get("cap_type"), "unknown")
    market_cap = format_market_cap(row.get("market_cap"))
    current_price = format_price(row.get("current_price"))
    year_high = format_price(row.get("year_high"))
    year_low = format_price(row.get("year_low"))
    price_1m = format_pct(row.get("price_change_1m"))
    price_3m = format_pct(row.get("price_change_3m"))
    volume = format_volume(row.get("avg_volume_20d"))
    volatility = format_pct(row.get("volatility_20d"))

    analyst_count = row.get("analyst_count", 0) or 0
    rec_key = safe_str(row.get("recommendation_key"), "none")
    rec_mean = safe_str(row.get("recommendation_mean"), "N/A")
    target_mean = format_price(row.get("target_mean_price"))
    target_high = format_price(row.get("target_high_price"))
    target_low = format_price(row.get("target_low_price"))

    coverage_score = format_score(row.get("coverage_score"))
    activity_score = format_score(row.get("activity_score"))
    quality_score = format_score(row.get("quality_score"))
    gap_score = format_score(row.get("gap_score"))
    opp_type = safe_str(row.get("opportunity_type"), "unclassified")
    confidence = format_score(row.get("confidence"))

    # --- Chunk A: Company Profile & Market Data ---
    chunk_a = (
        f"{name} ({ticker}) is a {cap_type}-cap {industry} company in the {sector} sector "
        f"with a market cap of {market_cap}. "
        f"It currently trades at {current_price}, with a 52-week range of {year_low} to {year_high}. "
        f"The stock has moved {price_1m} over the past month and {price_3m} over 3 months. "
        f"Its 20-day average trading volume is {volume} shares with a volatility of {volatility}."
    )

    # --- Chunk B: Coverage & Scoring Analysis ---
    chunk_b = (
        f"{name} ({ticker}) has {analyst_count} analyst(s) covering it, "
        f"with a consensus recommendation of {rec_key} (mean score {rec_mean}). "
        f"The average price target is {target_mean} (range: {target_low} to {target_high}). "
        f"Void AI scores: Coverage Score {coverage_score} out of 100, "
        f"Activity Score {activity_score}, Quality Score {quality_score}, "
        f"Gap Score {gap_score}. "
        f"It is classified as a {opp_type} opportunity with {confidence}% confidence."
    )

    return [
        (chunk_a, "company_overview"),
        (chunk_b, "coverage_analysis"),
    ]


# ======================================================================
# PART 4: Embed all chunks locally
# ======================================================================

def embed_chunks(texts):
    """Embed a list of texts using BAAI/bge-small-en-v1.5 locally."""
    from sentence_transformers import SentenceTransformer

    print("Loading embedding model: BAAI/bge-small-en-v1.5 (384 dims)...")
    model = SentenceTransformer("BAAI/bge-small-en-v1.5")

    print(f"Embedding {len(texts)} chunks...")
    embeddings = model.encode(
        texts,
        show_progress_bar=True,
        normalize_embeddings=True,  # Important for bge models + cosine similarity
        batch_size=64,
    )
    print(f"  Done. Shape: {embeddings.shape}\n")
    return embeddings


# ======================================================================
# PART 5: Clean old profiles & write to Haystack document store
# ======================================================================

def write_to_store(all_chunks):
    """
    Clean old stock_profile docs and write new ones to Haystack.
    all_chunks: list of (text, embedding, ticker, section) tuples
    """
    from rag.document_store import get_document_store
    from haystack import Document
    from haystack.document_stores.types import DuplicatePolicy

    print("Connecting to document store...")
    store = get_document_store()
    current_count = store.count_documents()
    print(f"  Current document count: {current_count}")

    # --- Delete old stock profiles ---
    print("Cleaning old stock profiles...")
    old_docs = store.filter_documents(
        filters={"field": "meta.source_type", "operator": "==", "value": "stock_profile"}
    )
    if old_docs:
        old_ids = [doc.id for doc in old_docs]
        store.delete_documents(document_ids=old_ids)
        print(f"  Deleted {len(old_ids)} old stock profile chunks")
    else:
        print(f"  No old stock profiles to delete")

    # --- Build Haystack Document objects ---
    print("Building Haystack documents...")
    documents = []
    for text, embedding, ticker, section in all_chunks:
        doc = Document(
            content=text,
            embedding=embedding.tolist(),
            meta={
                "ticker": ticker,
                "source_type": "stock_profile",
                "form_type": None,
                "section": section,
                "filing_date": None,
            }
        )
        documents.append(doc)

    # --- Write in batches ---
    print(f"Writing {len(documents)} chunks to document store...")
    batch_size = 100
    for i in range(0, len(documents), batch_size):
        batch = documents[i : i + batch_size]
        store.write_documents(batch, policy=DuplicatePolicy.OVERWRITE)
        if (i + batch_size) % 500 == 0 or i + batch_size >= len(documents):
            print(f"  Written {min(i + batch_size, len(documents))}/{len(documents)}")

    final_count = store.count_documents()
    print(f"  Final document count: {final_count}\n")


# ======================================================================
# PART 6: Main
# ======================================================================

def main():
    start = time.time()
    print("=" * 60)
    print("STEP 2: Generate Natural Language Stock Profiles")
    print("=" * 60 + "\n")

    # --- Fetch & merge ---
    df = fetch_and_merge()
    if df.empty:
        print("❌ No data after merge. Make sure all tables have data.")
        sys.exit(1)

    # --- Generate text chunks ---
    print("Generating stock profiles...")
    all_texts = []       # just the text strings (for batch embedding)
    all_meta = []        # (ticker, section) tuples to pair with embeddings later
    skipped = 0

    for _, row in df.iterrows():
        try:
            chunks = generate_chunks_for_ticker(row)
            for text, section in chunks:
                all_texts.append(text)
                all_meta.append((row["ticker"], section))
        except Exception as e:
            skipped += 1
            if skipped <= 5:
                print(f"  Warning: skipped {row.get('ticker', '?')}: {e}")

    print(f"  {len(all_texts)} chunks generated ({len(all_texts) // 2} tickers)")
    if skipped:
        print(f"  {skipped} tickers skipped due to errors")
    print()

    # --- Embed ---
    embeddings = embed_chunks(all_texts)

    # --- Combine into (text, embedding, ticker, section) tuples ---
    all_chunks = []
    for i, (text, (ticker, section)) in enumerate(zip(all_texts, all_meta)):
        all_chunks.append((text, embeddings[i], ticker, section))

    # --- Write to document store ---
    write_to_store(all_chunks)

    elapsed = time.time() - start
    print("=" * 60)
    print(f"✅ Done in {elapsed:.0f}s!")
    print(f"   Tickers processed: {len(df)}")
    print(f"   Chunks generated:  {len(all_texts)}")
    print(f"   Skipped:           {skipped}")
    print("=" * 60)


if __name__ == "__main__":
    main()