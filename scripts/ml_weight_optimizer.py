#!/usr/bin/env python3
"""
ML Weight Optimizer: Learn optimal scoring engine weights from historical market data.

Builds a labeled dataset by recomputing sub-scores at past evaluation dates and
measuring actual 30-day forward returns. Trains multiple models and compares
learned weights against the hardcoded baseline (0.50 / 0.30 / 0.20).

Usage:
  python scripts/ml_weight_optimizer.py

Env (.env.local):
  SUPABASE_URL, SUPABASE_ANON_KEY
"""

import os
import sys
import time
import warnings
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv
from scipy import stats as sp_stats

from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score, mean_absolute_error
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

try:
    from xgboost import XGBRegressor
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False
    print("Warning: xgboost not installed, skipping XGBoost model")

warnings.filterwarnings("ignore", category=FutureWarning)

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

BASELINE_WEIGHTS = {"coverage": 0.50, "activity": 0.30, "quality": 0.20}
EVAL_OFFSETS_DAYS = [60, 90, 120, 150, 180]
FORWARD_RETURN_DAYS = 30
MIN_TICKERS_PER_CROSS_SECTION = 100

OUTPUT_DIR = os.path.join(_project_root, "ml_outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ===================== DATA FETCHING =====================

def fetch_all(table_name, select_query="*"):
    all_data, page_size, offset = [], 1000, 0
    while True:
        res = supabase.table(table_name).select(select_query).range(offset, offset + page_size - 1).execute()
        data = res.data or []
        all_data.extend(data)
        if len(data) < page_size:
            break
        offset += page_size
    return pd.DataFrame(all_data)


def load_all_data():
    print("Loading data from Supabase...")
    t0 = time.time()

    market_data = fetch_all("market_data", "ticker, date, open, high, low, close, volume")
    companies = fetch_all("companies", "ticker, sector, market_cap, industry, cap_type")
    coverage = fetch_all("analyst_coverage",
                         "ticker, analyst_count, recommendation_key, recommendation_mean, "
                         "target_mean_price, target_high_price, target_low_price")

    if market_data.empty or companies.empty or coverage.empty:
        print("One or more tables are empty. Cannot proceed.")
        sys.exit(1)

    market_data["date"] = pd.to_datetime(market_data["date"])
    for col in ["open", "high", "low", "close"]:
        market_data[col] = pd.to_numeric(market_data[col], errors="coerce")
    market_data["volume"] = pd.to_numeric(market_data["volume"], errors="coerce").fillna(0).astype(int)
    market_data = market_data.sort_values(["ticker", "date"]).reset_index(drop=True)

    companies["market_cap"] = pd.to_numeric(companies["market_cap"], errors="coerce").fillna(0).astype(float)
    companies["sector"] = companies["sector"].fillna("Unknown").astype(str)
    coverage["analyst_count"] = pd.to_numeric(coverage["analyst_count"], errors="coerce").fillna(0).astype(int)
    coverage["target_mean_price"] = pd.to_numeric(coverage["target_mean_price"], errors="coerce")

    n_tickers = market_data["ticker"].nunique()
    date_range = f"{market_data['date'].min().date()} to {market_data['date'].max().date()}"
    print(f"  market_data: {len(market_data):,} rows, {n_tickers} tickers, {date_range}")
    print(f"  companies: {len(companies)} rows")
    print(f"  analyst_coverage: {len(coverage)} rows")
    print(f"  Loaded in {time.time() - t0:.1f}s\n")

    return market_data, companies, coverage


# ===================== SCORING FUNCTIONS (mirrored from pipeline_daily.py) =====================

SIZE_MEGA, SIZE_LARGE, SIZE_MID, SIZE_SMALL = 200e9, 10e9, 2e9, 300e6


def _size_bucket(mcap):
    if mcap is None or (isinstance(mcap, float) and np.isnan(mcap)):
        return "unknown"
    if mcap >= SIZE_MEGA: return "mega"
    if mcap >= SIZE_LARGE: return "large"
    if mcap >= SIZE_MID: return "mid"
    if mcap >= SIZE_SMALL: return "small"
    return "micro"


def _log_score(value, low, high, score_low=0.0, score_high=100.0):
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return score_low
    value = max(value, low)
    value = min(value, high)
    if high <= low:
        return score_high
    return score_low + (np.log1p(value - low) / np.log1p(high - low)) * (score_high - score_low)


def compute_coverage_score(df):
    """Coverage score without momentum (no history_df available for past dates)."""
    peer_avg = df.groupby(["sector", "size_bucket"])["analyst_count"].transform("mean")
    sector_avg = df.groupby("sector")["analyst_count"].transform("mean")
    peer_avg = peer_avg.replace(0, np.nan).fillna(sector_avg).fillna(1)
    base_score = 100.0 * np.exp(-3.0 * (df["analyst_count"] / peer_avg).clip(lower=0))
    zero_bonus = np.where(df["analyst_count"] == 0, 10.0, 0.0)
    has_no_targets = (df["target_mean_price"].isna() | (df["target_mean_price"] == 0)).astype(float)
    target_bonus = has_no_targets * np.where(df["analyst_count"] <= 2, 8.0, 3.0)
    return (base_score + zero_bonus + target_bonus).clip(0, 100)


def compute_activity_score(df):
    df = df.copy()
    for col in ["avg_volume_20d", "volatility_20d", "price_change_1m"]:
        if col not in df.columns:
            df[col] = 0
    df["rel_volume"] = df.groupby(["sector", "size_bucket"])["avg_volume_20d"].transform(
        lambda x: x / (x.mean() + 1e-9))
    df["rel_volatility"] = df.groupby(["sector", "size_bucket"])["volatility_20d"].transform(
        lambda x: x / (x.mean() + 1e-9))
    df["momentum_abs"] = df["price_change_1m"].fillna(0).abs()
    for col in ["rel_volume", "rel_volatility", "momentum_abs"]:
        g = df.groupby(["sector", "size_bucket"])[col]
        mean_ = g.transform("mean")
        std_ = g.transform("std").replace(0, np.nan).fillna(1)
        df[f"z_{col}"] = (df[col] - mean_) / std_
    combined_z = (0.35 * df["z_rel_volume"].fillna(0)
                  + 0.35 * df["z_rel_volatility"].fillna(0)
                  + 0.30 * df["z_momentum_abs"].fillna(0))
    is_catalyst = ((df["rel_volume"] > 2.0)
                   & (df["rel_volatility"] > 1.5)
                   & (df["momentum_abs"] > df.groupby(["sector", "size_bucket"])["momentum_abs"].transform("mean")))
    return (50 + 15 * combined_z + np.where(is_catalyst, 12.0, 0.0)).clip(0, 100)


def compute_quality_score(df):
    size_score = df["market_cap"].apply(lambda x: _log_score(x, 100e6, 200e9))
    vol_col = "avg_volume_20d" if "avg_volume_20d" in df.columns else "volume"
    liq_score = df[vol_col].fillna(0).apply(lambda x: _log_score(x, 10_000, 5_000_000))
    price_col = "current_price" if "current_price" in df.columns else "close"
    price_score = df[price_col].fillna(0).apply(lambda x: _log_score(x, 1, 500))
    key_fields = ["market_cap", "avg_volume_20d", "current_price", "analyst_count",
                  "volatility_20d", "pe_ratio", "sector", "industry"]
    available = [c for c in key_fields if c in df.columns]
    completeness = df[available].apply(
        lambda row: sum(1 for v in row
                        if v is not None
                        and (not isinstance(v, float) or not np.isnan(v))
                        and v != 0 and v != "Unknown"), axis=1)
    completeness_score = (completeness / max(len(available), 1)) * 100
    return (0.30 * size_score + 0.30 * liq_score + 0.20 * price_score + 0.20 * completeness_score).clip(0, 100)


# ===================== HISTORICAL METRICS RECOMPUTATION =====================

def compute_metrics_at_date(market_data, eval_date):
    """Recompute stock metrics from market_data as of eval_date."""
    md = market_data[market_data["date"] <= eval_date].copy()
    if md.empty:
        return pd.DataFrame()

    rows = []
    for ticker, grp in md.groupby("ticker"):
        grp = grp.sort_values("date")
        if len(grp) < 20:
            continue

        close = grp["close"]
        volume = grp["volume"]
        current_price = close.iloc[-1]
        if current_price is None or np.isnan(current_price) or current_price <= 0:
            continue

        avg_vol_20d = int(volume.tail(20).mean()) if volume.tail(20).notna().any() else 0
        returns = close.pct_change(fill_method=None).tail(20).dropna()
        vol_20d = float(returns.std() * np.sqrt(252)) if len(returns) >= 2 else 0.0

        pc1 = float(close.pct_change(21, fill_method=None).iloc[-1]) if len(grp) >= 22 else 0.0
        pc3 = float(close.pct_change(63, fill_method=None).iloc[-1]) if len(grp) >= 64 else 0.0
        if np.isnan(pc1) or np.isinf(pc1): pc1 = 0.0
        if np.isnan(pc3) or np.isinf(pc3): pc3 = 0.0

        year_high = float(grp["high"].max())
        year_low = float(grp["low"].min())

        rows.append({
            "ticker": ticker,
            "current_price": round(current_price, 4),
            "avg_volume_20d": avg_vol_20d,
            "volatility_20d": round(vol_20d, 4),
            "price_change_1m": round(pc1, 4),
            "price_change_3m": round(pc3, 4),
            "year_high": round(year_high, 4),
            "year_low": round(year_low, 4),
        })

    return pd.DataFrame(rows)


def compute_forward_returns(market_data, eval_date, forward_days=30):
    """Compute forward return from eval_date to eval_date + forward_days."""
    target_date = eval_date + timedelta(days=int(forward_days * 1.5))

    md = market_data[
        (market_data["date"] >= eval_date) &
        (market_data["date"] <= target_date)
    ].copy()

    results = []
    for ticker, grp in md.groupby("ticker"):
        grp = grp.sort_values("date")
        if len(grp) < 2:
            continue
        close_start = grp["close"].iloc[0]
        close_end_candidates = grp[grp["date"] >= eval_date + timedelta(days=forward_days - 5)]
        if close_end_candidates.empty:
            continue
        close_end = close_end_candidates["close"].iloc[0]

        if close_start is None or close_end is None or close_start <= 0:
            continue
        if np.isnan(close_start) or np.isnan(close_end):
            continue

        fwd_return = (close_end / close_start) - 1.0
        if np.isnan(fwd_return) or np.isinf(fwd_return):
            continue
        results.append({"ticker": ticker, "forward_return": round(fwd_return, 6)})

    return pd.DataFrame(results)


# ===================== DATASET BUILDER =====================

def build_labeled_dataset(market_data, companies, coverage):
    """Build cross-sectional labeled dataset across multiple evaluation dates."""
    print("=" * 60)
    print("BUILDING LABELED DATASET")
    print("=" * 60)

    max_date = market_data["date"].max()
    all_samples = []

    for offset in EVAL_OFFSETS_DAYS:
        eval_date = max_date - timedelta(days=offset)
        print(f"\n  Eval date: {eval_date.date()} (T-{offset}d)")

        metrics = compute_metrics_at_date(market_data, eval_date)
        if metrics.empty:
            print(f"    Skipped: no metrics computable")
            continue

        fwd = compute_forward_returns(market_data, eval_date, FORWARD_RETURN_DAYS)
        if fwd.empty:
            print(f"    Skipped: no forward returns computable")
            continue

        companies_copy = companies.copy()
        companies_copy["size_bucket"] = companies_copy["market_cap"].map(_size_bucket)

        df = (companies_copy[["ticker", "sector", "market_cap", "industry", "size_bucket"]]
              .merge(metrics, on="ticker", how="inner")
              .merge(coverage[["ticker", "analyst_count", "target_mean_price"]], on="ticker", how="inner")
              .merge(fwd, on="ticker", how="inner"))

        if len(df) < MIN_TICKERS_PER_CROSS_SECTION:
            print(f"    Skipped: only {len(df)} tickers (min {MIN_TICKERS_PER_CROSS_SECTION})")
            continue

        df["coverage_score"] = compute_coverage_score(df)
        df["activity_score"] = compute_activity_score(df)
        df["quality_score"] = compute_quality_score(df)

        sector_median_return = df.groupby("sector")["forward_return"].transform("median")
        df["alpha"] = df["forward_return"] - sector_median_return

        df["eval_date"] = eval_date.date()
        all_samples.append(df[["ticker", "eval_date", "sector", "coverage_score",
                                "activity_score", "quality_score", "forward_return", "alpha"]])

        print(f"    {len(df)} samples | fwd_return: mean={df['forward_return'].mean():.4f} "
              f"std={df['forward_return'].std():.4f} | alpha: mean={df['alpha'].mean():.4f}")

    if not all_samples:
        print("\nNo valid cross-sections found. Need more market_data history.")
        sys.exit(1)

    dataset = pd.concat(all_samples, ignore_index=True)
    dataset = dataset.replace([np.inf, -np.inf], np.nan).dropna(
        subset=["coverage_score", "activity_score", "quality_score", "alpha"])

    print(f"\n  Total dataset: {len(dataset)} samples across "
          f"{dataset['eval_date'].nunique()} eval dates, "
          f"{dataset['ticker'].nunique()} unique tickers")

    return dataset


# ===================== MODEL TRAINING =====================

def train_and_evaluate(dataset):
    """Train multiple models and evaluate against baseline."""
    print("\n" + "=" * 60)
    print("MODEL TRAINING & EVALUATION")
    print("=" * 60 + "\n")

    feature_cols = ["coverage_score", "activity_score", "quality_score"]
    X = dataset[feature_cols].values
    y = dataset["alpha"].values

    alpha_clip = np.percentile(np.abs(y), 99)
    mask = np.abs(y) <= alpha_clip
    X, y = X[mask], y[mask]
    print(f"  After outlier clipping (99th pct): {len(y)} samples\n")

    baseline_score = (BASELINE_WEIGHTS["coverage"] * X[:, 0]
                      + BASELINE_WEIGHTS["activity"] * X[:, 1]
                      + BASELINE_WEIGHTS["quality"] * X[:, 2])
    baseline_spearman = sp_stats.spearmanr(baseline_score, y).statistic
    baseline_r2 = r2_score(y, baseline_score * (np.std(y) / (np.std(baseline_score) + 1e-9)))

    quintile_size = len(y) // 5
    baseline_rank = np.argsort(np.argsort(-baseline_score))
    top_quintile_mask = baseline_rank < quintile_size
    baseline_hit_rate = (y[top_quintile_mask] > np.median(y)).mean() if top_quintile_mask.sum() > 0 else 0.0

    print(f"  BASELINE (hardcoded 0.50/0.30/0.20):")
    print(f"    Spearman correlation: {baseline_spearman:.4f}")
    print(f"    Hit rate (top quintile > median): {baseline_hit_rate:.2%}")
    print()

    eval_dates = dataset["eval_date"].unique()
    eval_dates_sorted = sorted(eval_dates)

    models = {
        "LinearRegression": LinearRegression(),
        "Ridge": Ridge(alpha=1.0),
        "RandomForest": RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42),
    }
    if HAS_XGBOOST:
        models["XGBoost"] = XGBRegressor(n_estimators=100, max_depth=3, learning_rate=0.1,
                                          random_state=42, verbosity=0)

    results = {}

    for name, model in models.items():
        print(f"  Training: {name}")

        cv_scores = cross_val_score(model, X, y, cv=5, scoring="r2")
        print(f"    5-fold CV R2: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")

        if len(eval_dates_sorted) >= 3:
            split_idx = len(eval_dates_sorted) * 2 // 3
            train_dates = set(eval_dates_sorted[:split_idx])
            test_dates = set(eval_dates_sorted[split_idx:])

            train_mask_wf = dataset["eval_date"].isin(train_dates).values[mask]
            test_mask_wf = dataset["eval_date"].isin(test_dates).values[mask]

            if train_mask_wf.sum() > 50 and test_mask_wf.sum() > 50:
                model.fit(X[train_mask_wf], y[train_mask_wf])
                y_pred_test = model.predict(X[test_mask_wf])
                wf_spearman = sp_stats.spearmanr(y_pred_test, y[test_mask_wf]).statistic
                wf_r2 = r2_score(y[test_mask_wf], y_pred_test)
                print(f"    Walk-forward R2: {wf_r2:.4f}")
                print(f"    Walk-forward Spearman: {wf_spearman:.4f}")

        model.fit(X, y)
        y_pred = model.predict(X)

        spearman = sp_stats.spearmanr(y_pred, y).statistic
        r2 = r2_score(y, y_pred)
        mae = mean_absolute_error(y, y_pred)

        pred_rank = np.argsort(np.argsort(-y_pred))
        top_q = pred_rank < quintile_size
        hit_rate = (y[top_q] > np.median(y)).mean() if top_q.sum() > 0 else 0.0

        ic_values = []
        for ed in eval_dates_sorted:
            ed_mask = dataset["eval_date"].values[mask] == ed
            if ed_mask.sum() > 20:
                ic = sp_stats.spearmanr(y_pred[ed_mask], y[ed_mask]).statistic
                ic_values.append(ic)
        mean_ic = np.mean(ic_values) if ic_values else 0.0
        ic_ir = (np.mean(ic_values) / (np.std(ic_values) + 1e-9)) if len(ic_values) > 1 else 0.0

        if hasattr(model, "coef_"):
            raw_w = model.coef_
            w_sum = np.abs(raw_w).sum()
            if w_sum > 0:
                norm_w = np.abs(raw_w) / w_sum
            else:
                norm_w = np.array([1/3, 1/3, 1/3])
            print(f"    Learned weights: coverage={norm_w[0]:.4f} activity={norm_w[1]:.4f} quality={norm_w[2]:.4f}")
            print(f"    Raw coefficients: {raw_w}")
        elif hasattr(model, "feature_importances_"):
            fi = model.feature_importances_
            norm_w = fi / fi.sum() if fi.sum() > 0 else np.array([1/3, 1/3, 1/3])
            print(f"    Feature importance: coverage={norm_w[0]:.4f} activity={norm_w[1]:.4f} quality={norm_w[2]:.4f}")
        else:
            norm_w = np.array([1/3, 1/3, 1/3])

        improvement_spearman = spearman - baseline_spearman
        improvement_hit = hit_rate - baseline_hit_rate

        print(f"    R2: {r2:.4f} | MAE: {mae:.4f}")
        print(f"    Spearman: {spearman:.4f} (vs baseline: {improvement_spearman:+.4f})")
        print(f"    Hit rate: {hit_rate:.2%} (vs baseline: {improvement_hit:+.2%})")
        print(f"    Mean IC: {mean_ic:.4f} | IC IR: {ic_ir:.4f}")

        _, p_value = sp_stats.spearmanr(y_pred, y)
        print(f"    Spearman p-value: {p_value:.6f} {'***' if p_value < 0.01 else '**' if p_value < 0.05 else '*' if p_value < 0.1 else 'n.s.'}")
        print()

        results[name] = {
            "model": model,
            "weights": norm_w,
            "r2": r2,
            "spearman": spearman,
            "hit_rate": hit_rate,
            "mae": mae,
            "mean_ic": mean_ic,
            "p_value": p_value,
            "cv_r2_mean": cv_scores.mean(),
        }

    return results, {
        "spearman": baseline_spearman,
        "hit_rate": baseline_hit_rate,
        "weights": np.array([0.50, 0.30, 0.20]),
    }


# ===================== VISUALIZATION =====================

def generate_charts(results, baseline, dataset):
    """Generate comparison charts and save as PNG."""
    feature_names = ["Coverage", "Activity", "Quality"]

    fig, axes = plt.subplots(1, 2, figsize=(14, 6))

    model_names = ["Baseline"] + list(results.keys())
    all_weights = [baseline["weights"]] + [r["weights"] for r in results.values()]

    x = np.arange(len(feature_names))
    width = 0.8 / len(model_names)
    for i, (name, weights) in enumerate(zip(model_names, all_weights)):
        offset = (i - len(model_names) / 2 + 0.5) * width
        bars = axes[0].bar(x + offset, weights, width, label=name)
    axes[0].set_ylabel("Normalized Weight")
    axes[0].set_title("Learned Weights vs Baseline")
    axes[0].set_xticks(x)
    axes[0].set_xticklabels(feature_names)
    axes[0].legend(fontsize=8)
    axes[0].set_ylim(0, 0.8)

    names = list(results.keys())
    spearman_vals = [results[n]["spearman"] for n in names]
    hit_vals = [results[n]["hit_rate"] for n in names]
    baseline_sp = baseline["spearman"]
    baseline_hr = baseline["hit_rate"]

    x2 = np.arange(len(names))
    bars1 = axes[1].bar(x2 - 0.2, spearman_vals, 0.35, label="Spearman Corr")
    axes[1].axhline(y=baseline_sp, color="blue", linestyle="--", alpha=0.5, label=f"Baseline Spearman ({baseline_sp:.3f})")
    ax2 = axes[1].twinx()
    bars2 = ax2.bar(x2 + 0.2, hit_vals, 0.35, label="Hit Rate", color="orange", alpha=0.8)
    ax2.axhline(y=baseline_hr, color="orange", linestyle="--", alpha=0.5, label=f"Baseline Hit Rate ({baseline_hr:.1%})")

    axes[1].set_ylabel("Spearman Correlation")
    ax2.set_ylabel("Hit Rate")
    axes[1].set_title("Model Performance vs Baseline")
    axes[1].set_xticks(x2)
    axes[1].set_xticklabels(names, rotation=15, ha="right")

    lines1, labels1 = axes[1].get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    axes[1].legend(lines1 + lines2, labels1 + labels2, fontsize=7, loc="upper left")

    plt.tight_layout()
    chart_path = os.path.join(OUTPUT_DIR, "weight_comparison.png")
    plt.savefig(chart_path, dpi=150)
    plt.close()
    print(f"  Chart saved: {chart_path}")

    return chart_path


# ===================== STORE RESULTS =====================

def store_learned_weights(results, dataset):
    """Upsert best model's learned weights to Supabase."""
    print("\n" + "=" * 60)
    print("STORING LEARNED WEIGHTS")
    print("=" * 60 + "\n")

    eval_dates_str = ", ".join(str(d) for d in sorted(dataset["eval_date"].unique()))
    records = []

    for name, res in results.items():
        w = res["weights"]
        record = {
            "model_name": name,
            "w_coverage": round(float(w[0]), 4),
            "w_activity": round(float(w[1]), 4),
            "w_quality": round(float(w[2]), 4),
            "r_squared": round(float(res["r2"]), 6),
            "spearman_corr": round(float(res["spearman"]), 6),
            "hit_rate": round(float(res["hit_rate"]), 4),
            "sample_count": len(dataset),
            "eval_dates": eval_dates_str,
            "trained_at": datetime.utcnow().isoformat(),
            "notes": f"CV R2={res['cv_r2_mean']:.4f}, MAE={res['mae']:.4f}, p={res['p_value']:.6f}",
        }
        records.append(record)
        print(f"  {name}: w=[{w[0]:.4f}, {w[1]:.4f}, {w[2]:.4f}] "
              f"R2={res['r2']:.4f} Spearman={res['spearman']:.4f}")

    try:
        for rec in records:
            supabase.table("ml_learned_weights").insert(rec).execute()
        print(f"\n  Stored {len(records)} model results to ml_learned_weights table")
    except Exception as e:
        print(f"\n  Warning: could not store to Supabase: {e}")
        print("  (This is OK if the table hasn't been created yet via migration)")

    report_path = os.path.join(OUTPUT_DIR, "optimization_report.json")
    report = {
        "trained_at": datetime.utcnow().isoformat(),
        "sample_count": len(dataset),
        "eval_dates": eval_dates_str,
        "baseline_weights": BASELINE_WEIGHTS,
        "models": {
            name: {
                "weights": {"coverage": round(float(r["weights"][0]), 4),
                            "activity": round(float(r["weights"][1]), 4),
                            "quality": round(float(r["weights"][2]), 4)},
                "r_squared": round(float(r["r2"]), 6),
                "spearman": round(float(r["spearman"]), 6),
                "hit_rate": round(float(r["hit_rate"]), 4),
                "cv_r2_mean": round(float(r["cv_r2_mean"]), 6),
                "p_value": round(float(r["p_value"]), 8),
            }
            for name, r in results.items()
        },
    }
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"  Report saved: {report_path}")


# ===================== FINAL SUMMARY =====================

def print_final_summary(results, baseline):
    print("\n" + "=" * 60)
    print("FINAL SUMMARY")
    print("=" * 60)

    print(f"\n  Baseline (hardcoded): coverage=0.50  activity=0.30  quality=0.20")
    print(f"  Baseline Spearman: {baseline['spearman']:.4f}  Hit Rate: {baseline['hit_rate']:.2%}\n")

    best_name, best_sp = None, -999
    for name, res in results.items():
        if res["spearman"] > best_sp:
            best_name, best_sp = name, res["spearman"]

    for name, res in results.items():
        w = res["weights"]
        marker = " <-- BEST" if name == best_name else ""
        print(f"  {name}:{marker}")
        print(f"    Weights: coverage={w[0]:.4f}  activity={w[1]:.4f}  quality={w[2]:.4f}")
        print(f"    Spearman: {res['spearman']:.4f} ({res['spearman'] - baseline['spearman']:+.4f} vs baseline)")
        print(f"    Hit Rate: {res['hit_rate']:.2%} ({res['hit_rate'] - baseline['hit_rate']:+.2%} vs baseline)")
        print(f"    p-value:  {res['p_value']:.6f}")
        print()

    if best_name:
        best = results[best_name]
        print(f"  RECOMMENDATION: Use {best_name} weights")
        print(f"    W_COVERAGE = {best['weights'][0]:.4f}")
        print(f"    W_ACTIVITY = {best['weights'][1]:.4f}")
        print(f"    W_QUALITY  = {best['weights'][2]:.4f}")
        print(f"\n  Set USE_ML_WEIGHTS=true in .env.local to use these in the daily pipeline.")

    print("\n" + "=" * 60 + "\n")


# ===================== MAIN =====================

def main():
    print("=" * 60)
    print("ML WEIGHT OPTIMIZER")
    print(f"Baseline weights: coverage={BASELINE_WEIGHTS['coverage']}, "
          f"activity={BASELINE_WEIGHTS['activity']}, quality={BASELINE_WEIGHTS['quality']}")
    print(f"Eval offsets: {EVAL_OFFSETS_DAYS} days back")
    print(f"Forward return window: {FORWARD_RETURN_DAYS} days")
    print("=" * 60 + "\n")

    market_data, companies, coverage = load_all_data()
    dataset = build_labeled_dataset(market_data, companies, coverage)
    results, baseline = train_and_evaluate(dataset)
    generate_charts(results, baseline, dataset)
    store_learned_weights(results, dataset)
    print_final_summary(results, baseline)

    print("Done.")


if __name__ == "__main__":
    main()
