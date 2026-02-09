#!/usr/bin/env python3
"""
Quick SEC 10-K / 10-Q fetch test for a few tickers.

This does NOT use any paid API. It hits the official SEC "submissions" JSON
endpoint and downloads the latest 10-K / 10-Q HTML filings for 2–3 companies
so we can verify that we can reliably retrieve documents for RAG.

Usage:
  python scripts/test_sec_fetch.py

Requirements:
  - Environment variable SEC_USER_AGENT must be set, e.g. in .env.local:
      SEC_USER_AGENT="Your Name Contact@Email.com"
    The SEC requires a descriptive User-Agent with contact information.
"""

import os
import pathlib
import textwrap
from typing import Dict, List

import requests
from dotenv import load_dotenv


BASE_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
ARCHIVES_BASE = "https://www.sec.gov/Archives/edgar/data/{cik}/{acc_no}/{primary_doc}"

# Hardcoded test companies with their CIKs (zero-padded to 10 digits)
TEST_COMPANIES: Dict[str, str] = {
    "AAPL": "0000320193",
    "MSFT": "0000789019",
    "AMZN": "0001018724",
}

FORMS = {"10-K", "10-Q"}


def get_user_agent() -> str:
    # Load .env.local from project root so SEC_USER_AGENT is picked up
    here = pathlib.Path(__file__).resolve()
    project_root = here.parent.parent
    env_path = project_root / ".env.local"
    if env_path.exists():
        load_dotenv(env_path)

    ua = os.getenv("SEC_USER_AGENT")
    if not ua:
        raise RuntimeError(
            "SEC_USER_AGENT not set. Add something like "
            'SEC_USER_AGENT="Your Name contact@example.com" '
            "to .env.local or your environment."
        )
    return ua


def fetch_submissions(cik: str, ua: str) -> dict:
    url = BASE_URL.format(cik=cik)
    resp = requests.get(url, headers={"User-Agent": ua}, timeout=15)
    resp.raise_for_status()
    return resp.json()


def list_recent_filings(data: dict) -> List[dict]:
    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])
    primary_docs = recent.get("primaryDocument", [])

    filings = []
    for form, date, acc, doc in zip(forms, dates, accessions, primary_docs):
        filings.append(
            {
                "form": form,
                "date": date,
                "accession": acc,
                "primary_doc": doc,
            }
        )
    return filings


def build_filing_url(cik: str, accession: str, primary_doc: str) -> str:
    # SEC archives URL format uses CIK without leading zeros and accession without dashes
    cik_no_zeros = str(int(cik))
    acc_no_dashes = accession.replace("-", "")
    return ARCHIVES_BASE.format(cik=cik_no_zeros, acc_no=acc_no_dashes, primary_doc=primary_doc)


def download_filing(ticker: str, cik: str, filing: dict, ua: str, out_dir: pathlib.Path) -> pathlib.Path:
    url = build_filing_url(cik, filing["accession"], filing["primary_doc"])
    resp = requests.get(url, headers={"User-Agent": ua}, timeout=30)
    resp.raise_for_status()

    out_dir.mkdir(parents=True, exist_ok=True)
    clean_form = filing["form"].replace("/", "-")
    filename = f"{ticker}_{clean_form}_{filing['date']}.html"
    out_path = out_dir / filename
    out_path.write_bytes(resp.content)
    return out_path


def main():
    ua = get_user_agent()
    out_dir = pathlib.Path(__file__).resolve().parent / "sec_samples"

    print("\n=== SEC 10-K / 10-Q FETCH TEST ===\n")
    print("Tickers:", ", ".join(TEST_COMPANIES.keys()))
    print(f"Output directory: {out_dir}\n")

    for ticker, cik in TEST_COMPANIES.items():
        print(f"--- {ticker} (CIK {cik}) ---")
        try:
            data = fetch_submissions(cik, ua)
            filings = list_recent_filings(data)
            # Filter to 10-K / 10-Q and take the most recent 2
            sec_filings = [f for f in filings if f["form"] in FORMS][:2]

            if not sec_filings:
                print("  No recent 10-K / 10-Q found.")
                continue

            for f in sec_filings:
                url = build_filing_url(cik, f["accession"], f["primary_doc"])
                print(
                    textwrap.dedent(
                        f"""
                        Form: {f['form']}
                        Date: {f['date']}
                        Accession: {f['accession']}
                        URL: {url}
                        """
                    ).strip()
                )
                # Download the HTML to verify we can grab full content
                path = download_filing(ticker, cik, f, ua, out_dir)
                print(f"  → Saved to: {path}")

        except Exception as e:
            print(f"  ERROR for {ticker}: {e}")

        print()

    print("Done.\n")


if __name__ == "__main__":
    main()

