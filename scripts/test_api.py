#!/usr/bin/env python3
"""
Test the FastAPI RAG service locally.

Start the server first:
  uvicorn rag.api:app --host 0.0.0.0 --port 8000 --reload

Then run this script:
  python scripts/test_api.py
"""

import requests
import json

BASE_URL = "http://localhost:8000"


def test_health():
    print("1. Health check...")
    r = requests.get(f"{BASE_URL}/health")
    print(f"   {r.status_code}: {r.json()}\n")


def test_focused():
    print("2. Focused mode — COKE: 'What are the key risks?'")
    r = requests.post(f"{BASE_URL}/chat", json={
        "message": "What are the key risks for this company?",
        "ticker": "COKE",
        "history": [],
    })
    data = r.json()
    print(f"   Mode: {data['mode']}")
    print(f"   Ticker: {data['ticker']}")
    print(f"   Reply ({len(data['reply'])} chars): {data['reply'][:300]}...")
    print(f"   Sources: {len(data['sources'])} docs")
    for i, s in enumerate(data["sources"][:3]):
        print(f"     [{i+1}] {s['ticker']} | {s['source_type']} | {s['form_type']} | {s['section']}")
    print()


def test_focused_undercovered():
    print("3. Focused mode — COKE: 'Why is this stock under-covered?'")
    r = requests.post(f"{BASE_URL}/chat", json={
        "message": "Why is this stock under-covered?",
        "ticker": "COKE",
        "history": [],
    })
    data = r.json()
    print(f"   Mode: {data['mode']}")
    print(f"   Reply ({len(data['reply'])} chars): {data['reply'][:300]}...")
    print(f"   Sources: {len(data['sources'])} docs")
    print()


def test_global():
    print("4. Global mode: 'Which stocks have the highest gap scores?'")
    r = requests.post(f"{BASE_URL}/chat", json={
        "message": "Which under-covered stocks have the highest gap scores?",
        "ticker": None,
        "history": [],
    })
    data = r.json()
    print(f"   Mode: {data['mode']}")
    print(f"   Ticker: {data['ticker']}")
    print(f"   Reply ({len(data['reply'])} chars): {data['reply'][:300]}...")
    print(f"   Sources: {len(data['sources'])} docs")
    print()


def test_with_history():
    print("5. Focused with history — COKE: 'Tell me more'")
    r = requests.post(f"{BASE_URL}/chat", json={
        "message": "Tell me more about that",
        "ticker": "COKE",
        "history": [
            {"role": "user", "content": "What are the key risks?"},
            {"role": "assistant", "content": "The main risks include customer concentration and cybersecurity threats."},
        ],
    })
    data = r.json()
    print(f"   Mode: {data['mode']}")
    print(f"   Reply ({len(data['reply'])} chars): {data['reply'][:300]}...")
    print()


def main():
    print("=" * 60)
    print("FastAPI RAG Service Test")
    print("=" * 60 + "\n")

    test_health()
    test_focused()
    test_focused_undercovered()
    test_global()
    test_with_history()

    print("=" * 60)
    print("Tests complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()