# yfinance: Correct Usage and Common Mistake

This document explains the right way to use `yfinance` in this project, the mistake that causes failures (wrong session type), and how to tell the difference between that bug and Yahoo blocking your IP.

---

## 1. The Mistake: Passing a `requests.Session` to yfinance

### What goes wrong

Recent versions of `yfinance` use **curl_cffi** internally, not the standard `requests` library. If you create a custom **`requests.Session`** and pass it into `yf.Ticker()` or `yf.download()`, yfinance expects a **`curl_cffi.requests.Session`**, not `requests.Session`.

**Incorrect (will fail):**

```python
import requests
import yfinance as yf

# ❌ Wrong: custom requests.Session
session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 ...',
    'Accept': 'text/html,application/xhtml+xml,...',
})

# ❌ Passing it into yfinance causes:
# "Yahoo API requires curl_cffi session not <class 'requests.sessions.Session'>.
#  Solution: stop setting session, let YF handle."
stock = yf.Ticker(ticker, session=session)
hist = stock.history(period="1y")
```

You will see:

- Error: **Yahoo API requires curl_cffi session not `<class 'requests.sessions.Session'>`. Solution: stop setting session, let YF handle.**
- Tickers fail even when Yahoo is not blocking your IP (e.g. in Colab).

### Root cause

- yfinance **internally** uses `curl_cffi` for HTTP.
- Passing `session=...` overrides its internal session.
- If that session is a `requests.Session`, the types don’t match and yfinance rejects it.

---

## 2. The Correct Way: Let yfinance Manage the Session

**Do not** pass a custom session. Use `yf.Ticker(ticker)` or `yf.download(...)` with no `session` argument.

**Correct:**

```python
import yfinance as yf

# ✅ No custom session — yfinance uses its own curl_cffi session
stock = yf.Ticker(ticker)
hist = stock.history(period="1y")
info = stock.info
```

Or for bulk download:

```python
import yfinance as yf

# ✅ Also correct — no session argument
df = yf.download("AAPL", period="5d", progress=False)
```

### Summary of the fix

| Step | Action |
|------|--------|
| 1 | Remove any code that creates a `requests.Session` for yfinance. |
| 2 | Stop passing `session=...` into `yf.Ticker(...)` or `yf.download(...)`. |
| 3 | Use `yf.Ticker(ticker)` and `stock.history(...)` / `stock.info` only. |

After this, yfinance uses its own HTTP layer and the “wrong session type” error goes away.

---

## 3. How This Repo (Void-AI) Uses yfinance

In this repository we **already use the correct pattern** (no custom session):

- **`scripts/minimal_fetch_test.py`**: `yf.Ticker(t)` then `stock.history(period="5d")`
- **`scripts/test_pipeline_50.py`**: `yf.Ticker(ticker)` then `stock.history(period="1y")`
- **`scripts/pipeline_daily.py`**: `yf.Ticker(ticker)`, `stock.history(period="1y")`, `stock.info`

So the **session bug** (passing `requests.Session` to yfinance) is **not** present here. If you still get no data or 429s locally or on GitHub Actions, that is almost certainly **Yahoo blocking the IP** (see below), not the session type.

---

## 4. 429 / “No Data” vs Session Bug

Two different issues can look similar:

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| Error: *“Yahoo API requires curl_cffi session not …”* | You passed a `requests.Session` to yfinance | Remove custom session; use correct pattern above. |
| Raw `requests.get(Yahoo URL)` returns **429** | Yahoo rate-limiting or blocking that IP | Does **not** by itself mean yfinance will fail; yfinance uses different paths and retries. |
| yfinance returns **empty data** / “(no data)” with **no** session error | Often Yahoo blocking the environment’s IP (e.g. local machine, GitHub Actions) | Same code may work from another IP (e.g. Colab). Not fixable by changing session in code. |

Important: a **429** from a manual `requests.get(...)` to a Yahoo URL only describes that one request. yfinance uses its own endpoints and logic; so 429 on the manual test does **not** automatically mean every yfinance call will fail. After fixing the session bug, yfinance can still succeed even when the manual test shows 429.

---

## 5. GitHub Actions and 429

On **GitHub Actions**, Yahoo often **rate-limits or blocks** the runner IP. The same code that works locally (or in Colab) can then get **429 Too Many Requests** and **JSONDecodeError** (Yahoo returns an error page instead of JSON). This is **not** a session bug — the repo already uses the correct pattern (no custom session).

**What we do:**

- **`pipeline_daily.py`** exits with code **1** when **≥50%** of tickers fail to fetch (configurable via `FAIL_IF_FETCH_PCT`). So the workflow shows **failed** instead of a misleading green checkmark when Yahoo blocks the run.
- The workflow sets `DELAY_SECONDS: "0.5"` to reduce request rate; it can help a little but often does not avoid 429 on GitHub’s IP.

**If the Daily Pipeline fails on GitHub with 429:**

- The **code and session usage are correct** (see [§2](#2-the-correct-way-let-yfinance-manage-the-session) and [§3](#3-how-this-repo-void-ai-uses-yfinance)).
- The failure is **Yahoo blocking the runner IP**. Options: run the pipeline **locally** or from **Colab** (or another IP Yahoo allows), or use a **cloud worker** with a different IP; see `docs/PIPELINE_AUTOMATION.md`.

---

## 6. Connectivity Test Script

To see both behaviours in one place we have:

**`scripts/yf_connectivity_test.py`**

It:

1. Calls **raw** `requests.get("https://query1.finance.yahoo.com/v8/finance/chart/AAPL", timeout=10)` and prints the status code (e.g. 429).
2. Calls **`yf.download("AAPL", period="5d", progress=False)`** with **no** custom session and prints whether data was returned and the last few rows.

Run:

```bash
python scripts/yf_connectivity_test.py
```

- If the **yfinance** part returns data: session usage is correct; any remaining issues are likely IP/rate limits.
- If the yfinance part shows “no data” while the raw request shows 429: in that environment the problem is **Yahoo blocking the IP**, not the session bug.

---

## 7. If You Ever Need a Custom Session (e.g. Proxies)

If you must pass a custom session (e.g. for proxies), it must be a **curl_cffi** session, not `requests.Session`:

```python
from curl_cffi.requests import Session as CurlSession
import yfinance as yf

session = CurlSession()
stock = yf.Ticker("AAPL", session=session)
# ...
```

For this project, the recommended approach is still **not** to pass any session and let yfinance manage its own session.

---

## 8. Quick Reference

**Do:**

- Use `yf.Ticker(ticker)` with **no** `session` argument.
- Use `yf.download(ticker, period=..., progress=False)` with **no** `session` argument.
- Rely on yfinance’s built-in HTTP handling (curl_cffi).

**Don’t:**

- Create a `requests.Session` and pass it into `yf.Ticker(..., session=session)` or `yf.download(..., session=session)`.
- Assume that a 429 from a manual `requests.get(Yahoo URL)` means yfinance cannot work; test yfinance itself (e.g. via `yf_connectivity_test.py`).

---

*Last updated for Void-AI pipeline and scripts using yfinance without a custom session.*
