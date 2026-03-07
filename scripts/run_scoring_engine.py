#!/usr/bin/env python3
"""
Scoring Engine v2: Coverage, Activity, Quality, and Gap scores
with coverage momentum, catalyst detection, continuous quality scoring,
and meaningful confidence scores.

Reads: companies, stock_metrics, analyst_coverage, analyst_coverage_history
Writes: coverage_gap_scores

Run after data is populated:
  python scripts/run_scoring_engine.py

Requires: SUPABASE_URL, SUPABASE_ANON_KEY in .env.local
"""

import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

# ──────────────────────────────────────────────────────────────
# ENV / SUPABASE SETUP
# ──────────────────────────────────────────────────────────────
_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_script_dir)
load_dotenv(os.path.join(_project_root, '.env.local'))

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY')
if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.local")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ──────────────────────────────────────────────────────────────
# CONSTANTS
# ──────────────────────────────────────────────────────────────
SIZE_MEGA = 200e9
SIZE_LARGE = 10e9
SIZE_MID = 2e9
SIZE_SMALL = 300e6

# Gap score weights
W_COVERAGE = 0.50
W_ACTIVITY = 0.30
W_QUALITY = 0.20

# Coverage momentum lookback (days)
MOMENTUM_LOOKBACK_DAYS = 30

# ──────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────

def size_bucket(mcap):
    if mcap is None or (isinstance(mcap, float) and np.isnan(mcap)):
        return "unknown"
    if mcap >= SIZE_MEGA: return "mega"
    if mcap >= SIZE_LARGE: return "large"
    if mcap >= SIZE_MID: return "mid"
    if mcap >= SIZE_SMALL: return "small"
    return "micro"


def fetch_all(table_name, select_query="*"):
    """Fetch all rows from a Supabase table using pagination."""
    all_data = []
    page_size = 1000
    offset = 0
    while True:
        res = supabase.table(table_name).select(select_query).range(offset, offset + page_size - 1).execute()
        data = res.data or []
        all_data.extend(data)
        if len(data) < page_size:
            break
        offset += page_size
    return pd.DataFrame(all_data)


def _log_score(value, low, high, score_low=0.0, score_high=100.0):
    """
    Continuous log-scale scoring between [low, high] → [score_low, score_high].
    Values below `low` get score_low, above `high` get score_high.
    """
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return score_low
    value = max(value, low)
    value = min(value, high)
    if high <= low:
        return score_high
    log_val = np.log1p(value - low)
    log_max = np.log1p(high - low)
    ratio = log_val / log_max if log_max > 0 else 0
    return score_low + ratio * (score_high - score_low)


# ──────────────────────────────────────────────────────────────
# FETCH TABLES
# ──────────────────────────────────────────────────────────────

def fetch_tables():
    print("Fetching companies, stock_metrics, analyst_coverage...")
    companies_df = fetch_all("companies", "ticker, sector, market_cap")
    metrics_df = fetch_all("stock_metrics", "*")
    coverage_df = fetch_all("analyst_coverage", "ticker, analyst_count, recommendation_key, recommendation_mean, target_mean_price, target_high_price, target_low_price")
    return companies_df, metrics_df, coverage_df


def fetch_coverage_history():
    """Fetch recent analyst_coverage_history for momentum calculation."""
    cutoff = (datetime.utcnow() - timedelta(days=MOMENTUM_LOOKBACK_DAYS + 7)).strftime("%Y-%m-%d")
    print(f"Fetching analyst_coverage_history since {cutoff}...")
    all_data = []
    page_size = 1000
    offset = 0
    while True:
        res = (
            supabase.table("analyst_coverage_history")
            .select("ticker, analyst_count, snapshot_date")
            .gte("snapshot_date", cutoff)
            .order("snapshot_date", desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        data = res.data or []
        all_data.extend(data)
        if len(data) < page_size:
            break
        offset += page_size
    df = pd.DataFrame(all_data)
    if not df.empty:
        df["snapshot_date"] = pd.to_datetime(df["snapshot_date"])
        df["analyst_count"] = pd.to_numeric(df["analyst_count"], errors="coerce").fillna(0).astype(int)
    print(f"  Loaded {len(df)} history rows for {df['ticker'].nunique() if not df.empty else 0} tickers")
    return df


# ──────────────────────────────────────────────────────────────
# MERGE
# ──────────────────────────────────────────────────────────────

def merge_tables(companies, metrics, coverage):
    companies = companies.copy()
    companies["market_cap"] = companies["market_cap"].fillna(0).astype(float)
    companies["size_bucket"] = companies["market_cap"].map(size_bucket)
    companies["sector"] = companies["sector"].fillna("Unknown").astype(str)
    df = (
        companies
        .merge(metrics, on="ticker", how="inner", suffixes=("", "_m"))
        .merge(coverage, on="ticker", how="inner")
    )
    return df


# ──────────────────────────────────────────────────────────────
# 1. COVERAGE SCORE (50% of gap score)
#    - Nonlinear penalty: zero analysts = 100, under-peer uses smooth curve
#    - Bonus for missing target prices (no targets + low count = stronger signal)
#    - Coverage momentum: declining analyst count boosts score
# ──────────────────────────────────────────────────────────────

def compute_coverage_momentum(df, history_df):
    """
    Compute per-ticker coverage momentum from analyst_coverage_history.
    Returns a Series indexed like df with momentum values:
      negative = analysts dropping coverage (bad coverage → high gap signal)
      zero     = stable
      positive = gaining coverage
    """
    momentum = pd.Series(0.0, index=df.index)
    if history_df.empty:
        print("  No coverage history found — momentum set to 0 for all tickers.")
        return momentum

    # For each ticker, compute slope of analyst_count over time
    ticker_to_idx = df.set_index("ticker").index
    slopes = {}
    for ticker, group in history_df.groupby("ticker"):
        if len(group) < 2:
            slopes[ticker] = 0.0
            continue
        # Simple linear regression: analyst_count vs day_number
        group = group.sort_values("snapshot_date")
        days = (group["snapshot_date"] - group["snapshot_date"].iloc[0]).dt.days.values.astype(float)
        counts = group["analyst_count"].values.astype(float)
        if days[-1] == 0:
            slopes[ticker] = 0.0
            continue
        # np.polyfit degree 1
        try:
            slope, _ = np.polyfit(days, counts, 1)
            slopes[ticker] = slope
        except Exception:
            slopes[ticker] = 0.0

    slope_series = df["ticker"].map(slopes).fillna(0.0)
    # Normalize: negative slope (losing analysts) → positive momentum signal
    # Scale so that losing 1 analyst per 30 days ≈ +15 points boost
    momentum = -slope_series * 30.0 * 15.0
    momentum = momentum.clip(-20, 25)  # cap the boost
    return momentum


def coverage_score_per_peer(df, history_df):
    # --- Base coverage ratio ---
    peer_avg = df.groupby(["sector", "size_bucket"])["analyst_count"].transform("mean")
    sector_avg = df.groupby("sector")["analyst_count"].transform("mean")
    peer_avg = peer_avg.replace(0, np.nan).fillna(sector_avg).fillna(1)
    ratio = df["analyst_count"] / peer_avg

    # Nonlinear curve: zero coverage = 100, ratio >= 1 = 0
    # Using exponential decay for smoother transition
    # score = 100 * exp(-3 * ratio) gives: ratio=0→100, ratio=0.5→22, ratio=1→5
    base_score = 100.0 * np.exp(-3.0 * ratio.clip(lower=0))

    # --- Zero-coverage bonus: fully uncovered stocks get extra signal ---
    zero_bonus = np.where(df["analyst_count"] == 0, 10.0, 0.0)

    # --- Missing target price penalty/bonus ---
    # No target prices + low analyst count = stronger gap signal
    has_no_targets = (
        df["target_mean_price"].isna() | (df["target_mean_price"] == 0)
    ).astype(float)
    target_bonus = has_no_targets * np.where(df["analyst_count"] <= 2, 8.0, 3.0)

    # --- Coverage momentum ---
    momentum_boost = compute_coverage_momentum(df, history_df)

    # --- Combine ---
    score = base_score + zero_bonus + target_bonus + momentum_boost
    return score.clip(0, 100)


# ──────────────────────────────────────────────────────────────
# 2. ACTIVITY SCORE (30% of gap score)
#    - Same z-score peer comparison
#    - NEW: Catalyst detection — volume spike + volatility + momentum = catalyst
# ──────────────────────────────────────────────────────────────

def activity_score_per_peer(df):
    for col in ["avg_volume_20d", "volatility_20d", "price_change_1m"]:
        if col not in df.columns:
            df[col] = 0

    # Relative metrics within peer group
    df["rel_volume"] = df.groupby(["sector", "size_bucket"])["avg_volume_20d"].transform(
        lambda x: x / (x.mean() + 1e-9)
    )
    df["rel_volatility"] = df.groupby(["sector", "size_bucket"])["volatility_20d"].transform(
        lambda x: x / (x.mean() + 1e-9)
    )
    df["momentum_abs"] = df["price_change_1m"].fillna(0).abs()

    # Z-scores
    for col in ["rel_volume", "rel_volatility", "momentum_abs"]:
        g = df.groupby(["sector", "size_bucket"])[col]
        mean_ = g.transform("mean")
        std_ = g.transform("std").replace(0, np.nan).fillna(1)
        df[f"z_{col}"] = (df[col] - mean_) / std_

    combined_z = (
        0.35 * df["z_rel_volume"].fillna(0)
        + 0.35 * df["z_rel_volatility"].fillna(0)
        + 0.30 * df["z_momentum_abs"].fillna(0)
    )
    base_score = 50 + 15 * combined_z

    # --- Catalyst detection ---
    # A catalyst event: volume > 2x peer avg AND volatility > 1.5x peer avg AND |momentum| > peer avg
    is_catalyst = (
        (df["rel_volume"] > 2.0) &
        (df["rel_volatility"] > 1.5) &
        (df["momentum_abs"] > df.groupby(["sector", "size_bucket"])["momentum_abs"].transform("mean"))
    )
    catalyst_boost = np.where(is_catalyst, 12.0, 0.0)
    print(f"  Catalyst events detected: {is_catalyst.sum()} tickers")

    score = base_score + catalyst_boost
    return score.clip(0, 100)


# ──────────────────────────────────────────────────────────────
# 3. QUALITY SCORE (20% of gap score)
#    - Continuous log-scale scoring (no cliff effects)
#    - Dimensions: market cap, liquidity, price, data completeness
# ──────────────────────────────────────────────────────────────

def quality_score_continuous(df):
    """Compute quality score using smooth log-scale functions."""
    # Market cap: $100M → 0, $200B+ → 100
    size_score = df["market_cap"].apply(lambda x: _log_score(x, 100e6, 200e9))

    # Liquidity (avg_volume_20d): 10K → 0, 5M+ → 100
    vol_col = "avg_volume_20d" if "avg_volume_20d" in df.columns else "volume"
    liq_score = df[vol_col].fillna(0).apply(lambda x: _log_score(x, 10_000, 5_000_000))

    # Price: $1 → 0, $500+ → 100
    price_col = "current_price" if "current_price" in df.columns else "close"
    price_score = df[price_col].fillna(0).apply(lambda x: _log_score(x, 1, 500))

    # Data completeness: count of non-null key fields
    key_fields = ["market_cap", "avg_volume_20d", "current_price", "analyst_count", "volatility_20d",
                  "pe_ratio", "sector", "industry"]
    completeness = df[
        [c for c in key_fields if c in df.columns]
    ].apply(lambda row: sum(
        1 for v in row
        if v is not None and (not isinstance(v, float) or not np.isnan(v)) and v != 0 and v != "Unknown"
    ), axis=1)
    max_fields = len([c for c in key_fields if c in df.columns])
    completeness_score = (completeness / max(max_fields, 1)) * 100

    # Weighted combination
    quality = (
        0.30 * size_score
        + 0.30 * liq_score
        + 0.20 * price_score
        + 0.20 * completeness_score
    )
    return quality.clip(0, 100)


# ──────────────────────────────────────────────────────────────
# 4. CONFIDENCE SCORE (no longer hardcoded!)
#    Based on: peer group size, data completeness, data freshness
# ──────────────────────────────────────────────────────────────

def compute_confidence(df):
    """
    Confidence in the gap score, based on:
      - Peer group size (more peers = more reliable comparison)
      - Data completeness (more fields = more reliable)
      - Data freshness (how recent is updated_at)
    """
    # --- Peer group size ---
    peer_count = df.groupby(["sector", "size_bucket"])["ticker"].transform("count")
    # 1 peer = low confidence, 50+ = high
    peer_conf = (peer_count.clip(upper=50) / 50.0 * 100).clip(0, 100)

    # --- Data completeness ---
    key_fields = ["market_cap", "avg_volume_20d", "current_price", "analyst_count",
                  "volatility_20d", "pe_ratio", "price_change_1m", "price_change_3m"]
    available_fields = [c for c in key_fields if c in df.columns]
    completeness = df[available_fields].apply(lambda row: sum(
        1 for v in row
        if v is not None and (not isinstance(v, float) or not np.isnan(v)) and v != 0
    ), axis=1)
    comp_conf = (completeness / max(len(available_fields), 1) * 100).clip(0, 100)

    # --- Data freshness ---
    if "updated_at" in df.columns:
        now = pd.Timestamp.utcnow()
        try:
            updated = pd.to_datetime(df["updated_at"], utc=True)
            hours_old = (now - updated).dt.total_seconds() / 3600.0
        except Exception:
            hours_old = pd.Series(24.0, index=df.index)
        # Fresh = <6h → 100, stale > 72h → 20
        freshness_conf = (100 - (hours_old.clip(0, 72) / 72 * 80)).clip(20, 100)
    else:
        freshness_conf = pd.Series(50.0, index=df.index)

    # Weighted combination
    confidence = (
        0.40 * peer_conf
        + 0.35 * comp_conf
        + 0.25 * freshness_conf
    )
    return confidence.clip(0, 100).round(2)


# ──────────────────────────────────────────────────────────────
# GAP SCORE + OPPORTUNITY TYPE
# ──────────────────────────────────────────────────────────────

def opportunity_type(gap_score):
    if gap_score >= 75:
        return "High Priority"
    if gap_score >= 60:
        return "Strong Opportunity"
    if gap_score >= 45:
        return "Moderate Opportunity"
    return "Low Priority"


# ──────────────────────────────────────────────────────────────
# DIAGNOSTICS
# ──────────────────────────────────────────────────────────────

def print_diagnostics(df):
    """Print summary stats so you can eyeball score distributions and tune weights."""
    print("\n" + "=" * 60)
    print("SCORE DIAGNOSTICS")
    print("=" * 60)
    for col in ["coverage_score", "activity_score", "quality_score", "gap_score", "confidence"]:
        if col in df.columns:
            s = df[col]
            print(f"\n  {col}:")
            print(f"    mean={s.mean():.1f}  median={s.median():.1f}  std={s.std():.1f}")
            print(f"    min={s.min():.1f}  25%={s.quantile(0.25):.1f}  75%={s.quantile(0.75):.1f}  max={s.max():.1f}")

    print(f"\n  Opportunity type distribution:")
    if "opportunity_type" in df.columns:
        counts = df["opportunity_type"].value_counts()
        for label, count in counts.items():
            pct = 100 * count / len(df)
            print(f"    {label}: {count} ({pct:.1f}%)")

    print(f"\n  Size bucket distribution:")
    if "size_bucket" in df.columns:
        counts = df["size_bucket"].value_counts()
        for label, count in counts.items():
            print(f"    {label}: {count}")
    print()


# ──────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Scoring Engine v2 — coverage, activity, quality, gap scores")
    print(f"Weights: coverage={W_COVERAGE}, activity={W_ACTIVITY}, quality={W_QUALITY}")
    print("=" * 60 + "\n")

    companies, metrics, coverage = fetch_tables()
    if companies.empty or metrics.empty or coverage.empty:
        print("Error: One or more tables are empty. Populate companies, stock_metrics, analyst_coverage first.")
        sys.exit(1)

    # Fetch coverage history for momentum
    history_df = fetch_coverage_history()

    df = merge_tables(companies, metrics, coverage)
    print(f"Merged {len(df)} tickers\n")

    # --- Compute scores ---
    print("Computing coverage scores (with momentum)...")
    df["coverage_score"] = coverage_score_per_peer(df, history_df)

    print("Computing activity scores (with catalyst detection)...")
    df["activity_score"] = activity_score_per_peer(df)

    print("Computing quality scores (continuous log-scale)...")
    df["quality_score"] = quality_score_continuous(df)

    # --- Gap score ---
    df["gap_score"] = (
        W_COVERAGE * df["coverage_score"]
        + W_ACTIVITY * df["activity_score"]
        + W_QUALITY * df["quality_score"]
    ).clip(0, 100)

    df["opportunity_type"] = df["gap_score"].map(opportunity_type)

    # --- Confidence ---
    print("Computing confidence scores...")
    df["confidence"] = compute_confidence(df)

    # --- Clean up numeric columns for JSON ---
    for col in ["coverage_score", "activity_score", "quality_score", "gap_score", "confidence"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").replace([np.inf, -np.inf], np.nan).fillna(0.0).round(2)

    df["updated_at"] = datetime.utcnow().isoformat()

    # --- Diagnostics ---
    print_diagnostics(df)

    # --- Upsert ---
    records = df[[
        "ticker", "coverage_score", "activity_score", "quality_score",
        "gap_score", "opportunity_type", "confidence", "updated_at",
    ]].to_dict("records")
    for r in records:
        for k, v in r.items():
            if isinstance(v, (np.floating, np.integer)):
                r[k] = float(v)

    print("Upserting coverage_gap_scores...")
    batch = 100
    for i in range(0, len(records), batch):
        supabase.table("coverage_gap_scores").upsert(
            records[i:i + batch], on_conflict="ticker"
        ).execute()
    print(f"Done. Upserted {len(records)} rows into coverage_gap_scores.\n")


if __name__ == "__main__":
    main()