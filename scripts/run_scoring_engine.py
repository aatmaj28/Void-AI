#!/usr/bin/env python3
"""
Scoring Engine: Compute coverage, activity, quality, and gap scores.

Reads companies, stock_metrics, analyst_coverage from Supabase.
Computes peer-group-based scores and upserts into coverage_gap_scores.

Run after data is populated:
  python scripts/run_scoring_engine.py

Requires: SUPABASE_URL, SUPABASE_ANON_KEY in .env.local
"""

import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

# Load env from project root
_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_script_dir)
load_dotenv(os.path.join(_project_root, '.env.local'))

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY')
if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.local")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Size buckets (market_cap in dollars)
SIZE_MEGA = 200e9
SIZE_LARGE = 10e9
SIZE_MID = 2e9
SIZE_SMALL = 300e6

def size_bucket(mcap):
    if mcap is None or (isinstance(mcap, float) and np.isnan(mcap)):
        return "unknown"
    if mcap >= SIZE_MEGA:
        return "mega"
    if mcap >= SIZE_LARGE:
        return "large"
    if mcap >= SIZE_MID:
        return "mid"
    if mcap >= SIZE_SMALL:
        return "small"
    return "micro"

def fetch_tables():
    print("Fetching companies, stock_metrics, analyst_coverage...")
    companies = supabase.table("companies").select("ticker, sector, market_cap").execute()
    metrics = supabase.table("stock_metrics").select("*").execute()
    coverage = supabase.table("analyst_coverage").select("ticker, analyst_count").execute()
    return (
        pd.DataFrame(companies.data),
        pd.DataFrame(metrics.data),
        pd.DataFrame(coverage.data),
    )

def merge_tables(companies, metrics, coverage):
    companies = companies.copy()
    companies["market_cap"] = companies["market_cap"].fillna(0).astype(float)
    companies["size_bucket"] = companies["market_cap"].map(size_bucket)
    companies["sector"] = companies["sector"].fillna("Unknown").astype(str)
    df = companies.merge(
        metrics, on="ticker", how="inner", suffixes=("", "_m")
    ).merge(coverage, on="ticker", how="inner")
    return df

def coverage_score_per_peer(df):
    peer_avg = df.groupby(["sector", "size_bucket"])["analyst_count"].transform("mean")
    sector_avg = df.groupby("sector")["analyst_count"].transform("mean")
    peer_avg = peer_avg.replace(0, np.nan).fillna(sector_avg).fillna(1)
    ratio = df["analyst_count"] / peer_avg
    score = (1 - np.minimum(ratio, 1.0)) * 100
    return np.maximum(0, np.minimum(100, score))

def activity_score_per_peer(df):
    for col in ["avg_volume_20d", "volatility_20d", "price_change_1m"]:
        if col not in df.columns:
            df[col] = 0
    df["rel_volume"] = df.groupby(["sector", "size_bucket"])["avg_volume_20d"].transform(
        lambda x: x / (x.mean() + 1e-9)
    )
    df["rel_volatility"] = df.groupby(["sector", "size_bucket"])["volatility_20d"].transform(
        lambda x: x / (x.mean() + 1e-9)
    )
    df["momentum_abs"] = df["price_change_1m"].fillna(0).abs()
    for col in ["rel_volume", "rel_volatility", "momentum_abs"]:
        g = df.groupby(["sector", "size_bucket"])[col]
        mean_, std_ = g.transform("mean"), g.transform("std").replace(0, np.nan).fillna(1)
        df[f"z_{col}"] = (df[col] - mean_) / std_
    combined_z = (
        0.4 * df["z_rel_volume"].fillna(0)
        + 0.4 * df["z_rel_volatility"].fillna(0)
        + 0.2 * df["z_momentum_abs"].fillna(0)
    )
    score = 50 + 15 * combined_z
    return np.maximum(0, np.minimum(100, score))

def quality_score_row(row):
    mcap = row.get("market_cap") or 0
    if mcap >= 10e9:
        size_s = 100
    elif mcap >= 5e9:
        size_s = 80
    elif mcap >= 2e9:
        size_s = 60
    elif mcap >= 500e6:
        size_s = 40
    else:
        size_s = 20
    vol = row.get("avg_volume_20d") or 0
    if vol >= 1e6:
        liq_s = 100
    elif vol >= 500e3:
        liq_s = 80
    elif vol >= 100e3:
        liq_s = 60
    elif vol >= 50e3:
        liq_s = 40
    else:
        liq_s = 20
    price = row.get("current_price") or 0
    if price >= 50:
        price_s = 100
    elif price >= 20:
        price_s = 80
    elif price >= 10:
        price_s = 60
    elif price >= 5:
        price_s = 40
    else:
        price_s = 20
    n_present = sum(
        1
        for k in ["market_cap", "avg_volume_20d", "current_price", "analyst_count", "volatility_20d"]
        if (row.get(k) is not None and (not isinstance(row.get(k), float) or not np.isnan(row.get(k))))
    )
    comp_s = 100 if n_present >= 5 else (80 if n_present >= 3 else (60 if n_present >= 1 else 40))
    return 0.3 * size_s + 0.3 * liq_s + 0.2 * price_s + 0.2 * comp_s

def opportunity_type(gap_score):
    if gap_score >= 75:
        return "High Priority"
    if gap_score >= 60:
        return "Strong Opportunity"
    if gap_score >= 45:
        return "Moderate Opportunity"
    return "Low Priority"

def main():
    print("Scoring Engine — computing coverage, activity, quality, gap scores\n")
    companies, metrics, coverage = fetch_tables()
    if companies.empty or metrics.empty or coverage.empty:
        print("Error: One or more tables are empty. Populate companies, stock_metrics, analyst_coverage first.")
        sys.exit(1)
    df = merge_tables(companies, metrics, coverage)
    print(f"Merged {len(df)} tickers with companies + stock_metrics + analyst_coverage\n")
    df["coverage_score"] = coverage_score_per_peer(df)
    df["activity_score"] = activity_score_per_peer(df)
    df["quality_score"] = df.apply(quality_score_row, axis=1)
    df["gap_score"] = (
        0.5 * df["coverage_score"]
        + 0.3 * df["activity_score"]
        + 0.2 * df["quality_score"]
    ).clip(0, 100)
    df["opportunity_type"] = df["gap_score"].map(opportunity_type)
    df["confidence"] = 70.0  # placeholder; can add peer group size / freshness later
    df["updated_at"] = datetime.utcnow().isoformat()
    records = df[
        [
            "ticker",
            "coverage_score",
            "activity_score",
            "quality_score",
            "gap_score",
            "opportunity_type",
            "confidence",
            "updated_at",
        ]
    ].to_dict("records")
    for r in records:
        for k, v in r.items():
            if isinstance(v, (np.floating, np.integer)):
                r[k] = float(v)
    print("Upserting coverage_gap_scores...")
    batch = 100
    for i in range(0, len(records), batch):
        supabase.table("coverage_gap_scores").upsert(
            records[i : i + batch], on_conflict="ticker"
        ).execute()
    print(f"Done. Upserted {len(records)} rows into coverage_gap_scores.\n")

if __name__ == "__main__":
    main()
