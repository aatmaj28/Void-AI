import os
import sys
from dotenv import load_dotenv
from supabase import create_client

_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_script_dir)
load_dotenv(os.path.join(_project_root, ".env.local"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_all(table_name, select_query="*"):
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
    return all_data

print("Fetching full data (paginated)...")
companies = fetch_all("companies", "ticker")
scores = fetch_all("coverage_gap_scores", "ticker")

print(f"Total Companies in DB: {len(companies)}")
print(f"Total Scores in DB:    {len(scores)}")

metricsByTicker = {c['ticker']: True for c in companies}
scoresByTicker = {s['ticker']: True for s in scores}

merged = [c for c in companies if scoresByTicker.get(c['ticker'])]
print(f"Merged Result Count (Paginated): {len(merged)}")

# Simulate un-paginated (what Vercel is likely running)
res_comp_nopag = supabase.table("companies").select("ticker").execute()
comp_nopag = res_comp_nopag.data or []
print(f"Companies (Un-paginated): {len(comp_nopag)}")

res_metrics_nopag = supabase.table("stock_metrics").select("ticker").execute()
metrics_nopag = res_metrics_nopag.data or []
print(f"Metrics (Un-paginated):   {len(metrics_nopag)}")

metricsByTicker_nopag = {m['ticker']: True for m in metrics_nopag}

merged_nopag = [c for c in comp_nopag if scoresByTicker.get(c['ticker']) and metricsByTicker_nopag.get(c['ticker'])]
print(f"Merged Result Count (Un-paginated intersection): {len(merged_nopag)}")
