#!/usr/bin/env python3
"""
Backtest Engine: Validate whether gap scores predict forward stock returns.

For each historical snapshot date in score_history:
  1. Get all stocks and their gap scores on that date
  2. Rank into quintiles (Q1 = top 20% gap score, Q5 = bottom 20%)
  3. Compute forward returns from market_data
  4. Compare quintile performance
  5. Store results in backtest_results + backtest_summary

Usage:
  python scripts/backtest_engine.py

Env (.env.local):
  SUPABASE_URL, SUPABASE_ANON_KEY
"""

import os
import sys
import time
import json
import warnings
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv
from scipy import stats as sp_stats

warnings.filterwarnings("ignore", category=FutureWarning)

# --- Path setup ---
_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_script_dir)
sys.path.insert(0, _project_root)
load_dotenv(os.path.join(_project_root, ".env.local"))

if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.local")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Config ---
FORWARD_DAYS_LIST = [7, 14, 30]          # Test multiple horizons
MIN_STOCKS_PER_DATE = 50                  # Skip dates with too few stocks
NUM_QUINTILES = 5

OUTPUT_DIR = os.path.join(_project_root, "backtest_outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ===================== DATA FETCHING =====================

def fetch_all(table_name, select_query="*"):
    """Paginated fetch from Supabase."""
    all_data, page_size, offset = [], 1000, 0
    while True:
        res = supabase.table(table_name).select(select_query).range(offset, offset + page_size - 1).execute()
        data = res.data or []
        all_data.extend(data)
        if len(data) < page_size:
            break
        offset += page_size
    return pd.DataFrame(all_data)


def load_data():
    """Load score_history and market_data from Supabase."""
    print("Loading data from Supabase...")
    t0 = time.time()

    # Score history: gap scores per ticker per date
    score_hist = fetch_all("score_history",
                           "ticker, snapshot_date, gap_score, coverage_score, activity_score, quality_score, "
                           "opportunity_type, confidence")

    # Market data: daily prices for forward return computation
    market_data = fetch_all("market_data", "ticker, date, close, volume")

    if score_hist.empty:
        print("  score_history table is empty.")
        print("  The daily pipeline needs to have run at least a few times to populate this.")
        print("  Falling back to coverage_gap_scores (current snapshot) + market_data for backtest.")
        return None, market_data

    # Parse types
    score_hist["snapshot_date"] = pd.to_datetime(score_hist["snapshot_date"])
    score_hist["gap_score"] = pd.to_numeric(score_hist["gap_score"], errors="coerce")
    for col in ["coverage_score", "activity_score", "quality_score", "confidence"]:
        if col in score_hist.columns:
            score_hist[col] = pd.to_numeric(score_hist[col], errors="coerce")

    market_data["date"] = pd.to_datetime(market_data["date"])
    market_data["close"] = pd.to_numeric(market_data["close"], errors="coerce")
    market_data["volume"] = pd.to_numeric(market_data["volume"], errors="coerce").fillna(0).astype(int)
    market_data = market_data.sort_values(["ticker", "date"]).reset_index(drop=True)

    n_dates = score_hist["snapshot_date"].nunique()
    n_tickers = score_hist["ticker"].nunique()
    md_range = f"{market_data['date'].min().date()} to {market_data['date'].max().date()}"

    print(f"  score_history: {len(score_hist):,} rows, {n_tickers} tickers, {n_dates} snapshot dates")
    print(f"  market_data:   {len(market_data):,} rows, range {md_range}")
    print(f"  Loaded in {time.time() - t0:.1f}s\n")

    return score_hist, market_data


def load_current_scores():
    """Fallback: use current coverage_gap_scores as a single snapshot."""
    print("  Loading current coverage_gap_scores as fallback...")
    scores = fetch_all("coverage_gap_scores",
                       "ticker, gap_score, coverage_score, activity_score, quality_score, "
                       "opportunity_type, confidence")
    if scores.empty:
        print("  coverage_gap_scores is also empty. Cannot run backtest.")
        sys.exit(1)

    scores["gap_score"] = pd.to_numeric(scores["gap_score"], errors="coerce")
    for col in ["coverage_score", "activity_score", "quality_score", "confidence"]:
        if col in scores.columns:
            scores[col] = pd.to_numeric(scores[col], errors="coerce")

    # Use today as the snapshot date
    scores["snapshot_date"] = pd.Timestamp.now().normalize()
    print(f"  Loaded {len(scores)} current scores as single snapshot\n")
    return scores


# ===================== FORWARD RETURN COMPUTATION =====================

def compute_forward_returns(market_data, eval_date, forward_days):
    """
    For each ticker, compute the return from eval_date to eval_date + forward_days.
    Uses the closest available trading day.
    """
    # Window: eval_date to eval_date + forward_days * 1.5 (to account for weekends/holidays)
    window_end = eval_date + timedelta(days=int(forward_days * 1.8))

    md = market_data[
        (market_data["date"] >= eval_date - timedelta(days=3)) &  # small buffer for start
        (market_data["date"] <= window_end)
    ].copy()

    if md.empty:
        return pd.DataFrame()

    results = []
    for ticker, grp in md.groupby("ticker"):
        grp = grp.sort_values("date").dropna(subset=["close"])
        if len(grp) < 2:
            continue

        # Find the close on or just after eval_date
        start_rows = grp[grp["date"] >= eval_date]
        if start_rows.empty:
            continue
        close_start = start_rows.iloc[0]["close"]
        start_actual_date = start_rows.iloc[0]["date"]

        # Find the close on or just after eval_date + forward_days
        target_date = eval_date + timedelta(days=forward_days)
        end_rows = grp[grp["date"] >= target_date - timedelta(days=3)]
        if end_rows.empty:
            continue
        close_end = end_rows.iloc[0]["close"]

        if close_start <= 0 or np.isnan(close_start) or np.isnan(close_end):
            continue

        fwd_return = (close_end / close_start) - 1.0
        if np.isnan(fwd_return) or np.isinf(fwd_return) or abs(fwd_return) > 2.0:
            continue  # Skip extreme outliers (>200% move)

        results.append({
            "ticker": ticker,
            "forward_return": round(fwd_return, 6),
        })

    return pd.DataFrame(results)


# ===================== QUINTILE ANALYSIS =====================

def run_quintile_analysis(scores_at_date, market_data, eval_date, forward_days):
    """
    Run quintile analysis for a single eval date and forward horizon.
    Returns a list of quintile result dicts.
    """
    # Get forward returns
    fwd = compute_forward_returns(market_data, eval_date, forward_days)
    if fwd.empty or len(fwd) < MIN_STOCKS_PER_DATE:
        return None, None

    # Merge scores with forward returns
    merged = scores_at_date.merge(fwd, on="ticker", how="inner")
    merged = merged.dropna(subset=["gap_score", "forward_return"])

    if len(merged) < MIN_STOCKS_PER_DATE:
        return None, None

    # Assign quintiles (Q1 = highest gap score, Q5 = lowest)
    merged["quintile"] = pd.qcut(
        merged["gap_score"], q=NUM_QUINTILES, labels=False, duplicates="drop"
    )
    # Invert so Q1 = top scores
    merged["quintile"] = NUM_QUINTILES - merged["quintile"]

    quintile_results = []
    for q in range(1, NUM_QUINTILES + 1):
        q_data = merged[merged["quintile"] == q]
        if q_data.empty:
            continue

        avg_return = q_data["forward_return"].mean()
        median_return = q_data["forward_return"].median()
        hit_rate = (q_data["forward_return"] > merged["forward_return"].median()).mean()

        best_idx = q_data["forward_return"].idxmax()
        worst_idx = q_data["forward_return"].idxmin()

        quintile_results.append({
            "eval_date": str(eval_date.date()),
            "forward_days": forward_days,
            "quintile": q,
            "stock_count": len(q_data),
            "avg_gap_score": round(q_data["gap_score"].mean(), 2),
            "avg_return": round(avg_return, 5),
            "median_return": round(median_return, 5),
            "hit_rate": round(hit_rate, 4),
            "best_ticker": q_data.loc[best_idx, "ticker"],
            "best_return": round(q_data.loc[best_idx, "forward_return"], 5),
            "worst_ticker": q_data.loc[worst_idx, "ticker"],
            "worst_return": round(q_data.loc[worst_idx, "forward_return"], 5),
        })

    # Overall stats for this date
    spearman_corr = sp_stats.spearmanr(merged["gap_score"], merged["forward_return"]).statistic
    if np.isnan(spearman_corr):
        spearman_corr = 0.0

    meta = {
        "eval_date": str(eval_date.date()),
        "forward_days": forward_days,
        "total_stocks": len(merged),
        "spearman_corr": round(spearman_corr, 4),
    }

    return quintile_results, meta


# ===================== MAIN BACKTEST =====================

def run_backtest():
    """Main backtest loop."""
    print("=" * 60)
    print("BACKTEST ENGINE — Gap Score Signal Validation")
    print("=" * 60 + "\n")

    score_hist, market_data = load_data()

    # Fallback to current scores if no history
    if score_hist is None:
        score_hist = load_current_scores()

    # Get unique snapshot dates
    snapshot_dates = sorted(score_hist["snapshot_date"].unique())
    print(f"  Snapshot dates available: {len(snapshot_dates)}")
    if len(snapshot_dates) > 0:
        print(f"  Range: {snapshot_dates[0].date()} to {snapshot_dates[-1].date()}")

    # For each date, we need enough future data for forward returns
    max_market_date = market_data["date"].max()
    print(f"  Market data available through: {max_market_date.date()}\n")

    all_quintile_results = []
    all_metas = []

    for forward_days in FORWARD_DAYS_LIST:
        print(f"\n{'=' * 50}")
        print(f"  Forward horizon: {forward_days} days")
        print(f"{'=' * 50}")

        usable_dates = [d for d in snapshot_dates
                        if d + timedelta(days=forward_days + 5) <= max_market_date]

        if not usable_dates:
            print(f"  No usable dates (need {forward_days}+ days of future data)")
            continue

        print(f"  Usable snapshot dates: {len(usable_dates)}")

        for eval_date in usable_dates:
            # Get scores for this date
            scores_at_date = score_hist[score_hist["snapshot_date"] == eval_date][
                ["ticker", "gap_score"]
            ].copy()

            if len(scores_at_date) < MIN_STOCKS_PER_DATE:
                continue

            qr, meta = run_quintile_analysis(scores_at_date, market_data, eval_date, forward_days)
            if qr is None:
                continue

            all_quintile_results.extend(qr)
            all_metas.append(meta)

            # Print summary for this date
            q1 = next((r for r in qr if r["quintile"] == 1), None)
            q5 = next((r for r in qr if r["quintile"] == NUM_QUINTILES), None)
            if q1 and q5:
                spread = q1["avg_return"] - q5["avg_return"]
                print(f"    {eval_date.date()}: Q1={q1['avg_return']:+.4f}  Q5={q5['avg_return']:+.4f}  "
                      f"Spread={spread:+.4f}  Spearman={meta['spearman_corr']:.4f}  "
                      f"n={meta['total_stocks']}")

    if not all_quintile_results:
        print("\n  No valid backtest results produced.")
        print("  This likely means the pipeline hasn't been running long enough")
        print("  to accumulate score history + forward return data.")
        print("\n  Generating synthetic backtest from current scores + historical prices...")
        all_quintile_results, all_metas = run_synthetic_backtest(score_hist, market_data)

    if not all_quintile_results:
        print("\n  Still no results. Cannot proceed.")
        sys.exit(1)

    # Aggregate results
    print_final_summary(all_quintile_results, all_metas)
    store_results(all_quintile_results, all_metas)
    save_report(all_quintile_results, all_metas)


def run_synthetic_backtest(score_hist, market_data):
    """
    Fallback: Use current gap scores + past market_data to simulate
    what would have happened. This works even with a single snapshot.
    """
    print("\n  Running synthetic backtest (reconstructing from market_data)...")

    # Get the latest scores for each ticker
    latest_date = score_hist["snapshot_date"].max()
    latest_scores = score_hist[score_hist["snapshot_date"] == latest_date][
        ["ticker", "gap_score"]
    ].drop_duplicates(subset=["ticker"])

    if len(latest_scores) < MIN_STOCKS_PER_DATE:
        return [], []

    max_market_date = market_data["date"].max()
    all_qr, all_meta = [], []

    # Test at multiple past dates (simulate as if we had the same scores back then)
    offsets = [30, 60, 90, 120]
    for offset in offsets:
        eval_date = max_market_date - timedelta(days=offset)

        for forward_days in FORWARD_DAYS_LIST:
            if eval_date + timedelta(days=forward_days + 5) > max_market_date:
                continue

            qr, meta = run_quintile_analysis(latest_scores, market_data, eval_date, forward_days)
            if qr is None:
                continue

            all_qr.extend(qr)
            all_meta.append(meta)

            q1 = next((r for r in qr if r["quintile"] == 1), None)
            q5 = next((r for r in qr if r["quintile"] == NUM_QUINTILES), None)
            if q1 and q5:
                spread = q1["avg_return"] - q5["avg_return"]
                print(f"    T-{offset}d ({eval_date.date()}) +{forward_days}d: "
                      f"Q1={q1['avg_return']:+.4f}  Q5={q5['avg_return']:+.4f}  "
                      f"Spread={spread:+.4f}")

    return all_qr, all_meta


# ===================== OUTPUT =====================

def print_final_summary(quintile_results, metas):
    """Print aggregate summary across all dates."""
    print("\n" + "=" * 60)
    print("BACKTEST SUMMARY")
    print("=" * 60)

    df = pd.DataFrame(quintile_results)

    for forward_days in FORWARD_DAYS_LIST:
        fd_data = df[df["forward_days"] == forward_days]
        if fd_data.empty:
            continue

        print(f"\n  --- {forward_days}-Day Forward Returns ---")

        for q in range(1, NUM_QUINTILES + 1):
            q_data = fd_data[fd_data["quintile"] == q]
            if q_data.empty:
                continue
            avg_ret = q_data["avg_return"].mean()
            avg_gap = q_data["avg_gap_score"].mean()
            avg_hit = q_data["hit_rate"].mean()
            print(f"    Q{q}: avg_return={avg_ret:+.4f}  avg_gap={avg_gap:.1f}  hit_rate={avg_hit:.1%}")

        q1_data = fd_data[fd_data["quintile"] == 1]
        q5_data = fd_data[fd_data["quintile"] == NUM_QUINTILES]
        if not q1_data.empty and not q5_data.empty:
            q1_ret = q1_data["avg_return"].mean()
            q5_ret = q5_data["avg_return"].mean()
            spread = q1_ret - q5_ret
            q1_hit = q1_data["hit_rate"].mean()

            fd_metas = [m for m in metas if m["forward_days"] == forward_days]
            avg_spearman = np.mean([m["spearman_corr"] for m in fd_metas]) if fd_metas else 0

            signal_valid = spread > 0 and avg_spearman > 0

            print(f"\n    Q1-Q5 Spread: {spread:+.4f} ({'POSITIVE' if spread > 0 else 'NEGATIVE'})")
            print(f"    Q1 Hit Rate:  {q1_hit:.1%}")
            print(f"    Avg Spearman: {avg_spearman:.4f}")
            print(f"    Signal Valid: {'YES' if signal_valid else 'NO'}")


def store_results(quintile_results, metas):
    """Store backtest results in Supabase."""
    print("\n" + "=" * 60)
    print("STORING RESULTS")
    print("=" * 60)

    # Store quintile results
    try:
        batch_size = 100
        for i in range(0, len(quintile_results), batch_size):
            batch = quintile_results[i:i + batch_size]
            # Add run_date
            for r in batch:
                r["run_date"] = datetime.utcnow().isoformat()
            supabase.table("backtest_results").upsert(
                batch, on_conflict="eval_date,forward_days,quintile"
            ).execute()
        print(f"  Stored {len(quintile_results)} quintile results")
    except Exception as e:
        print(f"  Warning: could not store backtest_results: {e}")
        print("  (Run migration 018_create_backtest_results.sql if table doesn't exist)")

    # Store summary
    for forward_days in FORWARD_DAYS_LIST:
        df = pd.DataFrame(quintile_results)
        fd_data = df[df["forward_days"] == forward_days]
        if fd_data.empty:
            continue

        q1_data = fd_data[fd_data["quintile"] == 1]
        q5_data = fd_data[fd_data["quintile"] == NUM_QUINTILES]
        if q1_data.empty or q5_data.empty:
            continue

        q1_ret = q1_data["avg_return"].mean()
        q5_ret = q5_data["avg_return"].mean()
        spread = q1_ret - q5_ret
        q1_hit = q1_data["hit_rate"].mean()

        fd_metas = [m for m in metas if m["forward_days"] == forward_days]
        avg_spearman = np.mean([m["spearman_corr"] for m in fd_metas]) if fd_metas else 0
        eval_dates_str = ", ".join(sorted(set(m["eval_date"] for m in fd_metas)))

        summary = {
            "run_date": datetime.utcnow().isoformat(),
            "eval_dates_used": eval_dates_str,
            "total_stocks": int(fd_data["stock_count"].sum() / NUM_QUINTILES) if not fd_data.empty else 0,
            "forward_days": forward_days,
            "q1_avg_return": round(float(q1_ret), 5),
            "q5_avg_return": round(float(q5_ret), 5),
            "q1_q5_spread": round(float(spread), 5),
            "q1_hit_rate": round(float(q1_hit), 4),
            "spearman_corr": round(float(avg_spearman), 4),
            "benchmark_return": None,  # Could add S&P 500 benchmark later
            "q1_alpha": None,
            "signal_is_valid": bool(spread > 0 and avg_spearman > 0),
        }

        try:
            supabase.table("backtest_summary").insert(summary).execute()
            print(f"  Stored summary for {forward_days}-day horizon "
                  f"(spread={spread:+.4f}, valid={'YES' if summary['signal_is_valid'] else 'NO'})")
        except Exception as e:
            print(f"  Warning: could not store backtest_summary: {e}")


def save_report(quintile_results, metas):
    """Save JSON report locally."""
    report = {
        "generated_at": datetime.utcnow().isoformat(),
        "forward_horizons": FORWARD_DAYS_LIST,
        "quintile_results": quintile_results,
        "meta": metas,
    }

    # Compute summary stats for report
    df = pd.DataFrame(quintile_results)
    summaries = {}
    for fd in FORWARD_DAYS_LIST:
        fd_data = df[df["forward_days"] == fd]
        if fd_data.empty:
            continue
        q1 = fd_data[fd_data["quintile"] == 1]["avg_return"].mean()
        q5 = fd_data[fd_data["quintile"] == NUM_QUINTILES]["avg_return"].mean()
        fd_metas = [m for m in metas if m["forward_days"] == fd]
        summaries[f"{fd}d"] = {
            "q1_return": round(float(q1), 5) if not np.isnan(q1) else None,
            "q5_return": round(float(q5), 5) if not np.isnan(q5) else None,
            "spread": round(float(q1 - q5), 5) if not (np.isnan(q1) or np.isnan(q5)) else None,
            "avg_spearman": round(np.mean([m["spearman_corr"] for m in fd_metas]), 4) if fd_metas else None,
            "n_eval_dates": len(fd_metas),
        }
    report["summary"] = summaries

    report_path = os.path.join(OUTPUT_DIR, "backtest_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\n  Report saved: {report_path}")


# ===================== MAIN =====================

def main():
    run_backtest()
    print("\nDone.")


if __name__ == "__main__":
    main()
