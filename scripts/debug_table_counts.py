#!/usr/bin/env python3
"""
Debug script: Check row counts and ticker overlap across Supabase tables.
Identifies why the scoring engine only merged 403 tickers when tables have ~1725 rows.
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client

_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_script_dir)
load_dotenv(os.path.join(_project_root, ".env.local"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_ANON_KEY")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_all_tickers(table_name, ticker_col="ticker"):
    """Fetch ALL tickers from a table, paginating past the 1000-row default limit."""
    all_tickers = []
    page_size = 1000
    offset = 0
    while True:
        res = supabase.table(table_name).select(ticker_col).range(offset, offset + page_size - 1).execute()
        rows = res.data or []
        all_tickers.extend([r[ticker_col] for r in rows])
        if len(rows) < page_size:
            break
        offset += page_size
    return set(all_tickers)

def fetch_without_pagination(table_name, ticker_col="ticker"):
    """Fetch tickers WITHOUT pagination (simulates what scoring engine does)."""
    res = supabase.table(table_name).select(ticker_col).execute()
    rows = res.data or []
    return set([r[ticker_col] for r in rows])

print("=" * 60)
print("STEP 1: Fetch WITH pagination (true count)")
print("=" * 60)

companies_all = fetch_all_tickers("companies")
metrics_all = fetch_all_tickers("stock_metrics")
coverage_all = fetch_all_tickers("analyst_coverage")
scores_all = fetch_all_tickers("coverage_gap_scores")

print(f"  companies:          {len(companies_all)} tickers")
print(f"  stock_metrics:      {len(metrics_all)} tickers")
print(f"  analyst_coverage:   {len(coverage_all)} tickers")
print(f"  coverage_gap_scores: {len(scores_all)} tickers")

print()
print("=" * 60)
print("STEP 2: Fetch WITHOUT pagination (what scoring engine does)")
print("=" * 60)

companies_nopag = fetch_without_pagination("companies")
metrics_nopag = fetch_without_pagination("stock_metrics")
coverage_nopag = fetch_without_pagination("analyst_coverage")

print(f"  companies (no pagination):        {len(companies_nopag)} tickers")
print(f"  stock_metrics (no pagination):    {len(metrics_nopag)} tickers")
print(f"  analyst_coverage (no pagination): {len(coverage_nopag)} tickers")

print()
print("=" * 60)
print("STEP 3: Inner join overlap (simulates scoring engine merge)")
print("=" * 60)

# What the scoring engine actually gets (no pagination)
inner_nopag = companies_nopag & metrics_nopag & coverage_nopag
print(f"  Inner join (no pagination): {len(inner_nopag)} tickers  <-- THIS is what scoring engine merges")

# What it SHOULD be (with pagination)
inner_all = companies_all & metrics_all & coverage_all
print(f"  Inner join (all rows):      {len(inner_all)} tickers  <-- THIS is what it should be")

print()
print("=" * 60)
print("STEP 4: Mismatches between tables (with full pagination)")
print("=" * 60)

in_companies_not_metrics = companies_all - metrics_all
in_companies_not_coverage = companies_all - coverage_all
in_metrics_not_companies = metrics_all - companies_all
in_coverage_not_companies = coverage_all - companies_all

print(f"  In companies but NOT in stock_metrics:    {len(in_companies_not_metrics)}")
print(f"  In companies but NOT in analyst_coverage: {len(in_companies_not_coverage)}")
print(f"  In stock_metrics but NOT in companies:    {len(in_metrics_not_companies)}")
print(f"  In analyst_coverage but NOT in companies: {len(in_coverage_not_companies)}")

if in_companies_not_metrics:
    sample = sorted(in_companies_not_metrics)[:10]
    print(f"    Sample (companies - metrics): {sample}")

if in_companies_not_coverage:
    sample = sorted(in_companies_not_coverage)[:10]
    print(f"    Sample (companies - coverage): {sample}")

print()
print("=" * 60)
print("DIAGNOSIS")
print("=" * 60)

if len(companies_nopag) == 1000 or len(metrics_nopag) == 1000 or len(coverage_nopag) == 1000:
    print()
    print(">>> ROOT CAUSE FOUND: Supabase default limit of 1000 rows!")
    print("    The scoring engine's fetch_tables() does NOT paginate.")
    print("    Each .select().execute() returns at most 1000 rows.")
    print("    When inner-joining three truncated sets, the overlap shrinks further.")
    print()
    print("    FIX: Add pagination to run_scoring_engine.py's fetch_tables() function,")
    print("    or use .range(0, 9999) to fetch more rows at once.")
else:
    print("    Supabase pagination is NOT the issue (all tables returned < 1000).")
    print("    The mismatch is due to actual data gaps between tables.")
