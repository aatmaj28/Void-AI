# Ticker universes: S&P 500, Russell 2000, S&P MidCap 400

The pipeline can pull tickers from three indices so you get large-caps (opportunistic), small-caps, and mid-caps in one run.

## Indices and data sources

| Universe    | Index              | Approx size | Typical use     | Data source |
|------------|--------------------|-------------|-----------------|-------------|
| **Large cap** | S&P 500          | 500         | Core / opportunistic | GitHub CSV (datasets) |
| **Small cap** | Russell 2000     | ~2000       | Small-cap opportunities | GitHub CSV (ikoniaris) |
| **Mid cap**   | **S&P MidCap 400** | ~400      | Mid-cap opportunities | Wikipedia (see below) |

### S&P 500 (existing)

- **Index:** S&P 500 — large-cap US equities.
- **URL:** `https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv`
- **Ticker column:** `Symbol`
- Already used by the daily pipeline.

### Russell 2000 (small cap)

- **Index:** Russell 2000 — small-cap US equities (~2000 names).
- **URL:** `https://raw.githubusercontent.com/ikoniaris/Russell2000/master/russell_2000_components.csv`
- **Ticker column:** `Ticker` (header may have a trailing space: `Ticker,Name `)
- Add via `TICKER_UNIVERSES` (see below).

### Mid cap: S&P MidCap 400

- **Index:** S&P MidCap 400 (S&P 400) — mid-cap US companies, typically market cap ~$2B–$10B. Maintained by S&P Dow Jones Indices.
- **Official data:** S&P does not publish a free constituent CSV. Options:
  - **Wikipedia:** [List of S&P 400 companies](https://en.wikipedia.org/wiki/List_of_S%26P_400_companies) has a table with a **Symbol** column. The pipeline can fetch this table via `pandas.read_html` when mid-cap is enabled.
  - **ETF holdings:** SPDR S&P MidCap 400 (MDY) or iShares Core S&P Mid-Cap (IJH) publish holdings; you could scrape or use a third-party list derived from them.
- **In this repo:** When `TICKER_UNIVERSES` includes `sp400`, the pipeline fetches the current S&P 400 list from the Wikipedia page above (no manual CSV needed). Parsing Wikipedia tables may require `pip install lxml` (or `html5lib`) if you see read_html errors.

## Using multiple universes

Set the env var **`TICKER_UNIVERSES`** to a comma-separated list. Tickers are merged and de-duplicated (so names in more than one index are only processed once).

Examples:

- **S&P 500 only (default):**  
  Do not set `TICKER_UNIVERSES`, or set `TICKER_UNIVERSES=sp500`.

- **S&P 500 + Russell 2000:**  
  `TICKER_UNIVERSES=sp500,russell2000`

- **All three (S&P 500 + Russell 2000 + S&P 400):**  
  `TICKER_UNIVERSES=sp500,russell2000,sp400`

Order does not matter; the final list is sorted and de-duplicated. With all three you get roughly 500 + 2000 + 400 minus overlaps (e.g. some names appear in both S&P 500 and S&P 400), so expect on the order of 2500–3000 unique tickers. The existing chunked fetch+upsert and retries still apply; you may want to increase `FETCH_CHUNK` or run time if needed.

## Summary

- **Yes, there is a mid-cap index you can use:** **S&P MidCap 400** (S&P 400).
- **Data:** No free official CSV; we use the Wikipedia list of S&P 400 companies (Symbol column) when `sp400` is in `TICKER_UNIVERSES`.
- **Russell 2000:** Use the ikoniaris GitHub CSV; column `Ticker`.
- **Pipeline:** Set `TICKER_UNIVERSES=sp500,russell2000,sp400` (or a subset) to run the same fetch + Supabase upsert + scoring over the combined universe.
