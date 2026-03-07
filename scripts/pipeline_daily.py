#!/usr/bin/env python3
"""
Daily Pipeline: Fetch market data, run scoring engine, generate RAG stock profiles.

Runs all 3 categories in sequence: S&P 500 (large cap) → S&P 400 (mid cap) → Russell 2000 (small cap).
For each ticker: yfinance history(1y) + info → market_data, stock_metrics, analyst_coverage, companies.
Then runs scoring engine v2 and generates stock profiles for the RAG document store.

Usage:
  python scripts/pipeline_daily.py

Env (.env.local):
  SUPABASE_URL, SUPABASE_ANON_KEY, PG_CONN_STRING

Optional:
  DELAY_SECONDS=0.35
  PROGRESS_EVERY=50
  FAIL_IF_FETCH_PCT=0
"""

import os
os.environ["USE_TF"] = "0"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import sys
import time
import requests
import pandas as pd
import numpy as np
import yfinance as yf
from io import StringIO
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

# --- Path setup ---
_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_script_dir)
sys.path.insert(0, _project_root)
load_dotenv(os.path.join(_project_root, ".env.local"))

# Fix Windows console encoding
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ---------- ENV ----------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
PG_CONN_STRING = os.getenv("PG_CONN_STRING")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.local")
    sys.exit(1)

# ---------- CONFIG ----------
WIKIPEDIA_SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
RUSSELL_2000_URL = "https://raw.githubusercontent.com/ikoniaris/Russell2000/master/russell_2000_components.csv"
WIKIPEDIA_SP400_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_400_companies"
DELAY = float(os.getenv("DELAY_SECONDS", "0.35"))
PROGRESS_EVERY = int(os.getenv("PROGRESS_EVERY", "50"))
FAIL_IF_FETCH_PCT = int(os.getenv("FAIL_IF_FETCH_PCT", "0"))
MARKET_BATCH = 200
METRICS_BATCH = 100
ANALYST_BATCH = 100
COMPANIES_BATCH = 100
HISTORY_BATCH = 100
UPSERT_RETRIES = 4
UPSERT_DELAY_SEC = 2.0
FETCH_CHUNK = 50
PAUSE_BETWEEN_CATEGORIES_SEC = 5

W_COVERAGE = 0.50
W_ACTIVITY = 0.30
W_QUALITY = 0.20
MOMENTUM_LOOKBACK_DAYS = 30

# ---------- yfinance cache ----------
_yf_cache = os.path.join(_project_root, ".yfinance_cache")
os.makedirs(_yf_cache, exist_ok=True)
try:
    yf.set_tz_cache_location(_yf_cache)
except Exception:
    pass

# ---------- Supabase client ----------
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
print("✅ Supabase client created")


# ===================== TICKER FETCHERS =====================

def _fetch_sp500():
    headers = {"User-Agent": "VoidAI-Pipeline/1.0 (data fetch; https://github.com)"}
    r = requests.get(WIKIPEDIA_SP500_URL, timeout=15, headers=headers)
    r.raise_for_status()
    tables = pd.read_html(StringIO(r.text), match="Symbol")
    if not tables:
        raise ValueError("No S&P 500 table found on Wikipedia")
    return tables[0]["Symbol"].astype(str).str.strip().str.replace(".", "-", regex=False).tolist()

def _fetch_russell2000():
    r = requests.get(RUSSELL_2000_URL, timeout=15)
    r.raise_for_status()
    df = pd.read_csv(StringIO(r.text))
    df.columns = df.columns.str.strip()
    col = "Ticker" if "Ticker" in df.columns else df.columns[0]
    return df[col].astype(str).str.strip().tolist()

def _fetch_sp400():
    headers = {"User-Agent": "VoidAI-Pipeline/1.0 (data fetch; https://github.com)"}
    r = requests.get(WIKIPEDIA_SP400_URL, timeout=15, headers=headers)
    r.raise_for_status()
    tables = pd.read_html(StringIO(r.text), match="Symbol")
    if not tables:
        raise ValueError("No S&P 400 table found on Wikipedia")
    df = tables[0]
    if "Symbol" not in df.columns:
        for c in df.columns:
            if "symbol" in str(c).lower() or df[c].dtype == object:
                return df[c].astype(str).str.strip().tolist()
        return df.iloc[:, 0].astype(str).str.strip().tolist()
    return df["Symbol"].astype(str).str.strip().tolist()


# ===================== FETCH ONE TICKER =====================

def fetch_one_ticker(ticker: str):
    try:
        stock = yf.Ticker(ticker)
        hist = yf.download(ticker, period="1y", progress=False)
        info = stock.info if hasattr(stock, "info") else {}

        if hist is not None and not hist.empty and isinstance(hist.columns, pd.MultiIndex):
            top_levels = hist.columns.get_level_values(0).unique()
            flat = {}
            for lev in top_levels:
                part = hist[lev]
                flat[lev] = part.iloc[:, 0] if isinstance(part, pd.DataFrame) else part
            hist = pd.DataFrame(flat, index=hist.index)

        market_rows, metrics_row, analyst_row, company_info = [], None, None, None

        def _s(val):
            return val.iloc[0] if hasattr(val, "iloc") else val

        def _finite_or_default(x, default=0.0):
            try:
                xv = float(x)
            except (TypeError, ValueError):
                return default
            return default if (np.isnan(xv) or np.isinf(xv)) else xv

        if hist is not None and not hist.empty and len(hist) >= 5:
            for date_ts, row in hist.iterrows():
                vol = _s(row.get("Volume"))
                vol = 0 if (vol is None or (isinstance(vol, float) and np.isnan(vol))) else int(vol)
                market_rows.append({
                    "ticker": ticker, "date": date_ts.strftime("%Y-%m-%d"),
                    "open": round(float(_s(row["Open"])), 4), "high": round(float(_s(row["High"])), 4),
                    "low": round(float(_s(row["Low"])), 4), "close": round(float(_s(row["Close"])), 4),
                    "volume": vol,
                })
            hist = hist.copy()
            hist["returns"] = hist["Close"].pct_change()
            avg_vol = int(hist["Volume"].tail(20).mean()) if hist["Volume"].tail(20).notna().any() else 0
            ret_tail = hist["returns"].tail(20).dropna()
            vol_20 = round(_finite_or_default(float(ret_tail.std() * np.sqrt(252)) if len(ret_tail) >= 2 else 0.0), 4)
            cur = round(_finite_or_default(hist["Close"].iloc[-1]), 4)
            pc1 = hist["Close"].pct_change(21).iloc[-1] if len(hist) >= 22 else np.nan
            pc3 = hist["Close"].pct_change(63).iloc[-1] if len(hist) >= 64 else np.nan
            ch1 = round(_finite_or_default(pc1), 4) if pd.notna(pc1) else 0.0
            ch3 = round(_finite_or_default(pc3), 4) if pd.notna(pc3) else 0.0
            yh = round(_finite_or_default(hist["High"].max()), 4)
            yl = round(_finite_or_default(hist["Low"].min()), 4)
            last_vol = hist["Volume"].iloc[-1]
            vol_latest = 0 if (last_vol is None or (isinstance(last_vol, float) and np.isnan(last_vol))) else int(last_vol)
            pe_ratio = None
            pe_raw = info.get("trailingPE")
            if pe_raw is not None:
                try:
                    pe_val = float(pe_raw)
                    if not (np.isnan(pe_val) or np.isinf(pe_val)):
                        pe_ratio = round(pe_val, 4)
                except (TypeError, ValueError):
                    pass
            metrics_row = {
                "ticker": ticker, "avg_volume_20d": avg_vol, "volatility_20d": vol_20,
                "price_change_1m": ch1, "price_change_3m": ch3, "current_price": cur,
                "year_high": yh, "year_low": yl, "volume": vol_latest, "pe_ratio": pe_ratio,
                "updated_at": datetime.utcnow().isoformat(),
            }
            company_info = {
                "name": info.get("longName") or info.get("shortName"), "sector": info.get("sector"),
                "industry": info.get("industry"), "market_cap": info.get("marketCap"),
                "exchange": info.get("exchange"), "country": info.get("country"),
            }

        ac = info.get("numberOfAnalystOpinions")
        ac = 0 if (ac is None or (isinstance(ac, float) and np.isnan(ac))) else int(ac)
        analyst_row = {
            "ticker": ticker, "analyst_count": ac, "recommendation_key": info.get("recommendationKey"),
            "recommendation_mean": info.get("recommendationMean"), "target_mean_price": info.get("targetMeanPrice"),
            "target_high_price": info.get("targetHighPrice"), "target_low_price": info.get("targetLowPrice"),
            "updated_at": datetime.utcnow().isoformat(),
        }
        return (market_rows, metrics_row, analyst_row, company_info)
    except Exception as e:
        print(f"[{ticker}] Error: {e}")
        return ([], None, {"ticker": ticker, "analyst_count": 0, "updated_at": datetime.utcnow().isoformat()}, None)


# ===================== UPSERT HELPERS =====================

def _execute_with_retry(execute_fn, batch_label: str):
    for attempt in range(UPSERT_RETRIES):
        try:
            execute_fn()
            return
        except Exception as e:
            err_str = str(type(e).__name__) + ": " + str(e)
            is_retryable = ("disconnect" in err_str.lower() or "502" in err_str or "500" in err_str or "APIError" in type(e).__name__ or "JSON could not be generated" in err_str)
            if is_retryable and attempt < UPSERT_RETRIES - 1:
                wait = UPSERT_DELAY_SEC * (2 ** attempt)
                print(f"  Supabase error ({batch_label}), retry in {wait:.0f}s: {err_str[:80]}...")
                time.sleep(wait)
            else:
                raise

def upsert_market_data(rows):
    for i in range(0, len(rows), MARKET_BATCH):
        batch = rows[i:i+MARKET_BATCH]
        _execute_with_retry(lambda b=batch: supabase.table("market_data").upsert(b, on_conflict="ticker,date").execute(), f"market_data batch {i//MARKET_BATCH+1}")
        time.sleep(0.3)
    print(f"  market_data: {len(rows)} rows")

def upsert_stock_metrics(rows):
    for i in range(0, len(rows), METRICS_BATCH):
        batch = rows[i:i+METRICS_BATCH]
        _execute_with_retry(lambda b=batch: supabase.table("stock_metrics").upsert(b, on_conflict="ticker").execute(), f"stock_metrics batch {i//METRICS_BATCH+1}")
        time.sleep(0.2)
    print(f"  stock_metrics: {len(rows)} rows")

def upsert_analyst_coverage(rows):
    for i in range(0, len(rows), ANALYST_BATCH):
        batch = rows[i:i+ANALYST_BATCH]
        _execute_with_retry(lambda b=batch: supabase.table("analyst_coverage").upsert(b, on_conflict="ticker").execute(), f"analyst_coverage batch {i//ANALYST_BATCH+1}")
        time.sleep(0.2)
    print(f"  analyst_coverage: {len(rows)} rows")

def upsert_analyst_coverage_history(rows):
    if not rows: return
    today = datetime.utcnow().strftime("%Y-%m-%d")
    history_rows = [{"ticker": r["ticker"], "analyst_count": r.get("analyst_count", 0), "recommendation_key": r.get("recommendation_key"), "recommendation_mean": r.get("recommendation_mean"), "target_mean_price": r.get("target_mean_price"), "snapshot_date": today} for r in rows]
    for i in range(0, len(history_rows), HISTORY_BATCH):
        batch = history_rows[i:i+HISTORY_BATCH]
        _execute_with_retry(lambda b=batch: supabase.table("analyst_coverage_history").upsert(b, on_conflict="ticker,snapshot_date").execute(), f"analyst_coverage_history batch {i//HISTORY_BATCH+1}")
        time.sleep(0.2)
    print(f"  analyst_coverage_history: {len(history_rows)} rows (snapshot {today})")

def upsert_companies(rows):
    if not rows: return
    for i in range(0, len(rows), COMPANIES_BATCH):
        batch = rows[i:i+COMPANIES_BATCH]
        _execute_with_retry(lambda b=batch: supabase.table("companies").upsert(b, on_conflict="ticker").execute(), f"companies batch {i//COMPANIES_BATCH+1}")
        time.sleep(0.2)
    print(f"  companies: {len(rows)} rows")


# ===================== SCORING ENGINE v2 =====================

SIZE_MEGA, SIZE_LARGE, SIZE_MID, SIZE_SMALL = 200e9, 10e9, 2e9, 300e6

def size_bucket(mcap):
    if mcap is None or (isinstance(mcap, float) and np.isnan(mcap)): return "unknown"
    if mcap >= SIZE_MEGA: return "mega"
    if mcap >= SIZE_LARGE: return "large"
    if mcap >= SIZE_MID: return "mid"
    if mcap >= SIZE_SMALL: return "small"
    return "micro"

def _log_score(value, low, high, score_low=0.0, score_high=100.0):
    if value is None or (isinstance(value, float) and np.isnan(value)): return score_low
    value = max(value, low); value = min(value, high)
    if high <= low: return score_high
    return score_low + (np.log1p(value - low) / np.log1p(high - low)) * (score_high - score_low)

def fetch_all(table_name, select_query="*"):
    all_data, page_size, offset = [], 1000, 0
    while True:
        res = supabase.table(table_name).select(select_query).range(offset, offset + page_size - 1).execute()
        data = res.data or []
        all_data.extend(data)
        if len(data) < page_size: break
        offset += page_size
    return pd.DataFrame(all_data)

def fetch_coverage_history():
    cutoff = (datetime.utcnow() - timedelta(days=MOMENTUM_LOOKBACK_DAYS + 7)).strftime("%Y-%m-%d")
    print(f"  Fetching analyst_coverage_history since {cutoff}...")
    all_data, page_size, offset = [], 1000, 0
    while True:
        res = supabase.table("analyst_coverage_history").select("ticker, analyst_count, snapshot_date").gte("snapshot_date", cutoff).order("snapshot_date", desc=False).range(offset, offset + page_size - 1).execute()
        data = res.data or []
        all_data.extend(data)
        if len(data) < page_size: break
        offset += page_size
    df = pd.DataFrame(all_data)
    if not df.empty:
        df["snapshot_date"] = pd.to_datetime(df["snapshot_date"])
        df["analyst_count"] = pd.to_numeric(df["analyst_count"], errors="coerce").fillna(0).astype(int)
    print(f"  Loaded {len(df)} history rows for {df['ticker'].nunique() if not df.empty else 0} tickers")
    return df

def compute_coverage_momentum(df, history_df):
    momentum = pd.Series(0.0, index=df.index)
    if history_df.empty: return momentum
    slopes = {}
    for ticker, group in history_df.groupby("ticker"):
        if len(group) < 2: slopes[ticker] = 0.0; continue
        group = group.sort_values("snapshot_date")
        days = (group["snapshot_date"] - group["snapshot_date"].iloc[0]).dt.days.values.astype(float)
        counts = group["analyst_count"].values.astype(float)
        if days[-1] == 0: slopes[ticker] = 0.0; continue
        try: slope, _ = np.polyfit(days, counts, 1); slopes[ticker] = slope
        except: slopes[ticker] = 0.0
    return (-df["ticker"].map(slopes).fillna(0.0) * 30.0 * 15.0).clip(-20, 25)

def coverage_score_per_peer(df, history_df):
    peer_avg = df.groupby(["sector", "size_bucket"])["analyst_count"].transform("mean")
    sector_avg = df.groupby("sector")["analyst_count"].transform("mean")
    peer_avg = peer_avg.replace(0, np.nan).fillna(sector_avg).fillna(1)
    base_score = 100.0 * np.exp(-3.0 * (df["analyst_count"] / peer_avg).clip(lower=0))
    zero_bonus = np.where(df["analyst_count"] == 0, 10.0, 0.0)
    has_no_targets = (df["target_mean_price"].isna() | (df["target_mean_price"] == 0)).astype(float)
    target_bonus = has_no_targets * np.where(df["analyst_count"] <= 2, 8.0, 3.0)
    return (base_score + zero_bonus + target_bonus + compute_coverage_momentum(df, history_df)).clip(0, 100)

def activity_score_per_peer(df):
    for col in ["avg_volume_20d", "volatility_20d", "price_change_1m"]:
        if col not in df.columns: df[col] = 0
    df["rel_volume"] = df.groupby(["sector", "size_bucket"])["avg_volume_20d"].transform(lambda x: x / (x.mean() + 1e-9))
    df["rel_volatility"] = df.groupby(["sector", "size_bucket"])["volatility_20d"].transform(lambda x: x / (x.mean() + 1e-9))
    df["momentum_abs"] = df["price_change_1m"].fillna(0).abs()
    for col in ["rel_volume", "rel_volatility", "momentum_abs"]:
        g = df.groupby(["sector", "size_bucket"])[col]
        mean_, std_ = g.transform("mean"), g.transform("std").replace(0, np.nan).fillna(1)
        df[f"z_{col}"] = (df[col] - mean_) / std_
    combined_z = 0.35 * df["z_rel_volume"].fillna(0) + 0.35 * df["z_rel_volatility"].fillna(0) + 0.30 * df["z_momentum_abs"].fillna(0)
    is_catalyst = (df["rel_volume"] > 2.0) & (df["rel_volatility"] > 1.5) & (df["momentum_abs"] > df.groupby(["sector", "size_bucket"])["momentum_abs"].transform("mean"))
    print(f"  Catalyst events detected: {is_catalyst.sum()} tickers")
    return (50 + 15 * combined_z + np.where(is_catalyst, 12.0, 0.0)).clip(0, 100)

def quality_score_continuous(df):
    size_score = df["market_cap"].apply(lambda x: _log_score(x, 100e6, 200e9))
    vol_col = "avg_volume_20d" if "avg_volume_20d" in df.columns else "volume"
    liq_score = df[vol_col].fillna(0).apply(lambda x: _log_score(x, 10_000, 5_000_000))
    price_col = "current_price" if "current_price" in df.columns else "close"
    price_score = df[price_col].fillna(0).apply(lambda x: _log_score(x, 1, 500))
    key_fields = ["market_cap", "avg_volume_20d", "current_price", "analyst_count", "volatility_20d", "pe_ratio", "sector", "industry"]
    completeness = df[[c for c in key_fields if c in df.columns]].apply(lambda row: sum(1 for v in row if v is not None and (not isinstance(v, float) or not np.isnan(v)) and v != 0 and v != "Unknown"), axis=1)
    completeness_score = (completeness / max(len([c for c in key_fields if c in df.columns]), 1)) * 100
    return (0.30 * size_score + 0.30 * liq_score + 0.20 * price_score + 0.20 * completeness_score).clip(0, 100)

def compute_confidence(df):
    peer_count = df.groupby(["sector", "size_bucket"])["ticker"].transform("count")
    peer_conf = (peer_count.clip(upper=50) / 50.0 * 100).clip(0, 100)
    key_fields = ["market_cap", "avg_volume_20d", "current_price", "analyst_count", "volatility_20d", "pe_ratio", "price_change_1m", "price_change_3m"]
    available_fields = [c for c in key_fields if c in df.columns]
    comp_conf = (df[available_fields].apply(lambda row: sum(1 for v in row if v is not None and (not isinstance(v, float) or not np.isnan(v)) and v != 0), axis=1) / max(len(available_fields), 1) * 100).clip(0, 100)
    if "updated_at" in df.columns:
        try:
            hours_old = (pd.Timestamp.utcnow() - pd.to_datetime(df["updated_at"], utc=True)).dt.total_seconds() / 3600.0
        except: hours_old = pd.Series(24.0, index=df.index)
        freshness_conf = (100 - (hours_old.clip(0, 72) / 72 * 80)).clip(20, 100)
    else: freshness_conf = pd.Series(50.0, index=df.index)
    return (0.40 * peer_conf + 0.35 * comp_conf + 0.25 * freshness_conf).clip(0, 100).round(2)

def opportunity_type(gap_score):
    if gap_score >= 75: return "High Priority"
    if gap_score >= 60: return "Strong Opportunity"
    if gap_score >= 45: return "Moderate Opportunity"
    return "Low Priority"

def print_diagnostics(df):
    print("\n" + "=" * 60 + "\nSCORE DIAGNOSTICS\n" + "=" * 60)
    for col in ["coverage_score", "activity_score", "quality_score", "gap_score", "confidence"]:
        if col in df.columns:
            s = df[col]
            print(f"\n  {col}: mean={s.mean():.1f} median={s.median():.1f} std={s.std():.1f} min={s.min():.1f} max={s.max():.1f}")
    if "opportunity_type" in df.columns:
        print(f"\n  Opportunity types:")
        for label, count in df["opportunity_type"].value_counts().items():
            print(f"    {label}: {count} ({100*count/len(df):.1f}%)")
    print()

def run_scoring_engine():
    print("\n" + "=" * 60)
    print("SCORING ENGINE v2")
    print(f"Weights: coverage={W_COVERAGE}, activity={W_ACTIVITY}, quality={W_QUALITY}")
    print("=" * 60 + "\n")
    companies = fetch_all("companies", "ticker, sector, market_cap, industry")
    metrics = fetch_all("stock_metrics", "*")
    coverage = fetch_all("analyst_coverage", "ticker, analyst_count, recommendation_key, recommendation_mean, target_mean_price, target_high_price, target_low_price")
    if companies.empty or metrics.empty or coverage.empty:
        print("Error: One or more tables are empty."); return 1
    history_df = fetch_coverage_history()
    companies["market_cap"] = companies["market_cap"].fillna(0).astype(float)
    companies["size_bucket"] = companies["market_cap"].map(size_bucket)
    companies["sector"] = companies["sector"].fillna("Unknown").astype(str)
    df = companies.merge(metrics, on="ticker", how="inner", suffixes=("", "_m")).merge(coverage, on="ticker", how="inner")
    print(f"Merged {len(df)} tickers\n")
    df["coverage_score"] = coverage_score_per_peer(df, history_df)
    df["activity_score"] = activity_score_per_peer(df)
    df["quality_score"] = quality_score_continuous(df)
    df["gap_score"] = (W_COVERAGE * df["coverage_score"] + W_ACTIVITY * df["activity_score"] + W_QUALITY * df["quality_score"]).clip(0, 100)
    df["opportunity_type"] = df["gap_score"].map(opportunity_type)
    df["confidence"] = compute_confidence(df)
    for col in ["coverage_score", "activity_score", "quality_score", "gap_score", "confidence"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").replace([np.inf, -np.inf], np.nan).fillna(0.0).round(2)
    df["updated_at"] = datetime.utcnow().isoformat()
    print_diagnostics(df)
    records = df[["ticker", "coverage_score", "activity_score", "quality_score", "gap_score", "opportunity_type", "confidence", "updated_at"]].to_dict("records")
    for r in records:
        for k, v in r.items():
            if isinstance(v, (np.floating, np.integer)): r[k] = float(v)
    print("Upserting coverage_gap_scores...")
    for i in range(0, len(records), 100):
        supabase.table("coverage_gap_scores").upsert(records[i:i+100], on_conflict="ticker").execute()
    print(f"Done. {len(records)} rows.\n")
    return 0


# ===================== STOCK PROFILE GENERATION (RAG) =====================

def _fmt_mcap(v):
    if v is None or (isinstance(v, float) and np.isnan(v)) or v == 0: return "N/A"
    v = float(v)
    if v >= 1e12: return f"${v/1e12:.1f}T"
    if v >= 1e9: return f"${v/1e9:.1f}B"
    if v >= 1e6: return f"${v/1e6:.0f}M"
    return f"${v:,.0f}"

def _fmt_vol(v):
    if v is None or (isinstance(v, float) and np.isnan(v)) or v == 0: return "N/A"
    return f"{int(v):,}"

def _fmt_price(v):
    if v is None or (isinstance(v, float) and np.isnan(v)) or v == 0: return "N/A"
    return f"${float(v):.2f}"

def _fmt_pct(v):
    if v is None or (isinstance(v, float) and np.isnan(v)): return "N/A"
    return f"{'+' if float(v) >= 0 else ''}{float(v):.1f}%"

def _fmt_score(v):
    if v is None or (isinstance(v, float) and np.isnan(v)): return "N/A"
    return f"{int(round(float(v)))}"

def _safe_str(v, d="N/A"):
    if v is None: return d
    if isinstance(v, float) and np.isnan(v): return d
    return str(v)

def _generate_profile_chunks(row):
    t, n = row["ticker"], _safe_str(row.get("name"), row["ticker"])
    chunk_a = (f"{n} ({t}) is a {_safe_str(row.get('cap_type'),'unknown')}-cap {_safe_str(row.get('industry'),'Unknown')} company in the {_safe_str(row.get('sector'),'Unknown')} sector with a market cap of {_fmt_mcap(row.get('market_cap'))}. It currently trades at {_fmt_price(row.get('current_price'))}, with a 52-week range of {_fmt_price(row.get('year_low'))} to {_fmt_price(row.get('year_high'))}. The stock has moved {_fmt_pct(row.get('price_change_1m'))} over the past month and {_fmt_pct(row.get('price_change_3m'))} over 3 months. Its 20-day average trading volume is {_fmt_vol(row.get('avg_volume_20d'))} shares with a volatility of {_fmt_pct(row.get('volatility_20d'))}.")
    chunk_b = (f"{n} ({t}) has {row.get('analyst_count',0) or 0} analyst(s) covering it, with a consensus recommendation of {_safe_str(row.get('recommendation_key'),'none')} (mean score {_safe_str(row.get('recommendation_mean'),'N/A')}). The average price target is {_fmt_price(row.get('target_mean_price'))} (range: {_fmt_price(row.get('target_low_price'))} to {_fmt_price(row.get('target_high_price'))}). Void AI scores: Coverage Score {_fmt_score(row.get('coverage_score'))} out of 100, Activity Score {_fmt_score(row.get('activity_score'))}, Quality Score {_fmt_score(row.get('quality_score'))}, Gap Score {_fmt_score(row.get('gap_score'))}. It is classified as a {_safe_str(row.get('opportunity_type'),'unclassified')} opportunity with {_fmt_score(row.get('confidence'))}% confidence.")
    return [(chunk_a, "company_overview"), (chunk_b, "coverage_analysis")]

def run_stock_profile_generation():
    from sentence_transformers import SentenceTransformer
    from haystack.utils import Secret
    from haystack_integrations.document_stores.pgvector import PgvectorDocumentStore
    from haystack import Document
    from haystack.document_stores.types import DuplicatePolicy

    if not PG_CONN_STRING:
        print("⚠️ PG_CONN_STRING not set — skipping stock profile generation.")
        return

    print("\n" + "=" * 60 + "\nSTOCK PROFILE GENERATION (RAG)\n" + "=" * 60 + "\n")
    start = time.time()

    companies = fetch_all("companies", "ticker, name, sector, industry, market_cap, cap_type")
    scores = fetch_all("coverage_gap_scores", "ticker, coverage_score, activity_score, quality_score, gap_score, opportunity_type, confidence")
    coverage = fetch_all("analyst_coverage", "ticker, analyst_count, recommendation_key, recommendation_mean, target_mean_price, target_high_price, target_low_price")
    metrics = fetch_all("stock_metrics", "ticker, avg_volume_20d, volatility_20d, price_change_1m, price_change_3m, current_price, year_high, year_low")
    print(f"  companies: {len(companies)}, scores: {len(scores)}, coverage: {len(coverage)}, metrics: {len(metrics)}")

    df = companies.merge(scores, on="ticker", how="inner").merge(coverage, on="ticker", how="inner").merge(metrics, on="ticker", how="inner")
    print(f"  Merged: {len(df)} tickers\n")
    if df.empty: print("❌ No data after merge."); return

    print("Generating stock profiles...")
    all_texts, all_meta, skipped = [], [], 0
    for _, row in df.iterrows():
        try:
            for text, section in _generate_profile_chunks(row):
                all_texts.append(text); all_meta.append((row["ticker"], section))
        except Exception as e:
            skipped += 1
            if skipped <= 5: print(f"  Warning: skipped {row.get('ticker','?')}: {e}")
    print(f"  {len(all_texts)} chunks ({len(all_texts)//2} tickers)\n")

    print("Loading embedding model...")
    model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    embeddings = model.encode(all_texts, show_progress_bar=True, normalize_embeddings=True, batch_size=64)
    print(f"  Embedded. Shape: {embeddings.shape}\n")

    print("Connecting to Haystack document store...")
    store = PgvectorDocumentStore(connection_string=Secret.from_token(PG_CONN_STRING), table_name="haystack_documents", embedding_dimension=384, vector_function="cosine_similarity", recreate_table=False, search_strategy="hnsw")
    print(f"  Current count: {store.count_documents()}")

    print("Cleaning old stock profiles...")
    old_docs = store.filter_documents(filters={"field": "meta.source_type", "operator": "==", "value": "stock_profile"})
    if old_docs:
        store.delete_documents(document_ids=[d.id for d in old_docs])
        print(f"  Deleted {len(old_docs)} old chunks")

    print(f"Writing {len(all_texts)} chunks...")
    documents = [Document(content=text, embedding=embeddings[i].tolist(), meta={"ticker": ticker, "source_type": "stock_profile", "form_type": None, "section": section, "filing_date": None}) for i, (text, (ticker, section)) in enumerate(zip(all_texts, all_meta))]
    for i in range(0, len(documents), 100):
        store.write_documents(documents[i:i+100], policy=DuplicatePolicy.OVERWRITE)
        if (i + 100) % 500 == 0 or i + 100 >= len(documents):
            print(f"  Written {min(i+100, len(documents))}/{len(documents)}")

    print(f"\n  Final count: {store.count_documents()}")
    print(f"✅ Profiles generated in {time.time()-start:.0f}s\n")


# ===================== MAIN PIPELINE =====================

def main():
    print("🚀 Daily pipeline — S&P 500 → S&P 400 → Russell 2000\n")
    categories = [("S&P 500", _fetch_sp500, "large"), ("S&P 400", _fetch_sp400, "mid"), ("Russell 2000", _fetch_russell2000, "small")]
    category_stats, total_passed, total_failed, skipped_no_mcap = {}, 0, 0, 0
    start = time.time()

    print("Fetching ticker lists...\n")
    seen_tickers, category_tickers = set(), {}
    for cat_name, fetch_fn, cap_type in categories:
        try: raw_tickers = fetch_fn()
        except Exception as e: print(f"Error fetching {cat_name}: {e}"); raw_tickers = []
        deduped = [t for t in raw_tickers if t not in seen_tickers]
        seen_tickers.update(deduped)
        category_tickers[cat_name] = deduped
        print(f"  {cat_name}: {len(deduped)} unique tickers")
    print(f"  Total: {len(seen_tickers)}\n")

    for cat_name, fetch_fn, cap_type in categories:
        tickers = category_tickers.get(cat_name, [])
        print("=" * 60 + f"\n{cat_name} (cap_type={cap_type})\n" + "=" * 60)
        if not tickers: category_stats[cat_name] = (0, 0, 0); continue
        print(f"Tickers: {len(tickers)}. Chunks of {FETCH_CHUNK}.\n")
        cat_passed, cat_failed, cat_skipped = 0, 0, 0

        for chunk_start in range(0, len(tickers), FETCH_CHUNK):
            chunk = tickers[chunk_start:chunk_start+FETCH_CHUNK]
            chunk_num = chunk_start // FETCH_CHUNK + 1
            print(f"--- Chunk {chunk_num}: tickers {chunk_start+1}-{chunk_start+len(chunk)} ---")
            chunk_market, chunk_metrics, chunk_analyst, chunk_companies = [], [], [], []
            for i, ticker in enumerate(chunk):
                market_rows, metrics_row, analyst_row, company_info = fetch_one_ticker(ticker)
                if metrics_row:
                    mcap = (company_info or {}).get("market_cap")
                    if mcap is None or (isinstance(mcap, (int, float)) and (np.isnan(mcap) if isinstance(mcap, float) else False or mcap <= 0)):
                        cat_skipped += 1; skipped_no_mcap += 1; time.sleep(DELAY); continue
                    chunk_market.extend(market_rows); chunk_metrics.append(metrics_row)
                    chunk_analyst.append(analyst_row); cat_passed += 1
                    chunk_companies.append({"ticker": ticker, "name": company_info.get("name"), "sector": company_info.get("sector"), "industry": company_info.get("industry"), "market_cap": company_info.get("market_cap"), "exchange": company_info.get("exchange"), "country": company_info.get("country"), "cap_type": cap_type})
                else: cat_failed += 1
                if (i + 1) % PROGRESS_EVERY == 0:
                    print(f"  Progress: {chunk_start+i+1}/{len(tickers)} — {len(chunk_market)} market, {len(chunk_metrics)} metrics — {time.time()-start:.0f}s")
                time.sleep(DELAY)
            print(f"  Chunk done: {len(chunk_market)} market, {len(chunk_metrics)} metrics. Upserting...")
            upsert_companies(chunk_companies); upsert_market_data(chunk_market)
            upsert_stock_metrics(chunk_metrics); upsert_analyst_coverage(chunk_analyst)
            upsert_analyst_coverage_history(chunk_analyst)
            print(f"  Chunk {chunk_num} upserted.\n")

        category_stats[cat_name] = (cat_passed, cat_failed, cat_skipped)
        total_passed += cat_passed; total_failed += cat_failed
        print(f"{cat_name}: {cat_passed} passed, {cat_failed} failed, {cat_skipped} skipped\n")
        if cat_name != categories[-1][0]: time.sleep(PAUSE_BETWEEN_CATEGORIES_SEC)

    elapsed = time.time() - start
    print("=" * 60 + "\nSUMMARY\n" + "=" * 60)
    for cat_name, (p, f, s) in category_stats.items(): print(f"  {cat_name}: {p} passed, {f} failed, {s} skipped")
    print(f"  Total: {total_passed} passed, {total_failed} failed, {skipped_no_mcap} skipped")
    print(f"\nFetch + upsert done in {elapsed:.0f}s.\n")

    scoring_ok = run_scoring_engine()
    print("\n✅ Scoring done!" if scoring_ok == 0 else "\n⚠️ Scoring errors.")

    # Generate stock profiles for RAG
    print("\n" + "=" * 60 + "\nGenerating stock profiles for RAG...\n" + "=" * 60)
    try:
        run_stock_profile_generation()
        print("✅ Stock profiles updated!")
    except Exception as e:
        print(f"⚠️ Profile generation failed: {e}")
        print("  (Pipeline data is saved — profiles can be regenerated later)")

    print(f"\n✅ Daily pipeline complete!")


if __name__ == "__main__":
    main()