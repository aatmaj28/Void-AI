# Supabase Pagination Fix

This document outlines the solution for the "1,000-row limit" issue encountered when scaling the Void AI database to several thousand tickers.

## The Problem
By default, the Supabase JavaScript and Python clients limit result sets to **1,000 rows** per request. As our ticker universe grew (S&P 500 + S&P 400 + Russell 2000 ≈ 2,900 tickers), this limit caused significant data discrepancies:

1.  **Scoring Engine Mismatch**: The scoring engine merged `companies`, `stock_metrics`, and `analyst_coverage` using an inner join. Because each table was truncated at 1,000 rows, the intersection was often much smaller (e.g., only 403 tickers were scored instead of the expected ~1,700).
2.  **Dashboard Truncation**: The `/api/opportunities` endpoint returned at most 1,000 companies, making the "Total Stocks Tracked" metric appear lower than the actual database count.

## The Solution
We implemented manual pagination (looping) in both the Python backend scripts and the Next.js API routes.

### 1. Python (Scoring Engine)
In `scripts/run_scoring_engine.py`, we added a `fetch_all` helper function that uses the `.range()` method to fetch data in chunks of 1,000 until the entire table is retrieved.

```python
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
    return pd.DataFrame(all_data)
```

### 2. TypeScript (Next.js API)
In `app/api/opportunities/route.ts`, we implemented a similar `fetchAll` local function within the `GET` handler.

```typescript
async function fetchAll(tableName: string, selectFields: string) {
  let allData: any[] = []
  let pageSize = 1000
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectFields)
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    allData = [...allData, ...data]
    if (data.length < pageSize) break
    offset += pageSize
  }
  return allData
}
```

## Results After Fix
- **Scoring Engine**: Now merges and upserts **1,726 tickers** (all stocks with valid current data).
- **Dashboard**: Correctly reports the total count of scored stocks without truncation.
- **Scalability**: The system is now prepared to handle 10,000+ tickers without missing data.
