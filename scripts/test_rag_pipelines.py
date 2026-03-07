#!/usr/bin/env python3
"""
Test the RAG retrieval pipelines (focused + global).
Runs a few sample queries and prints results.
"""

import os
os.environ["USE_TF"] = "0"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from rag.pipelines import query_focused, query_global


def print_docs(documents, label="Retrieved"):
    """Pretty-print retrieved documents."""
    print(f"\n  {label} ({len(documents)} docs):")
    for i, doc in enumerate(documents[:5]):
        ticker = doc.meta.get("ticker", "?")
        source = doc.meta.get("source_type", "?")
        form = doc.meta.get("form_type", "?")
        section = doc.meta.get("section", "?")
        snippet = doc.content[:120].replace("\n", " ")
        print(f"    [{i+1}] {ticker} | {source} | {form} | {section}")
        print(f"        {snippet}...")
    print()


def main():
    print("=" * 60)
    print("RAG Pipeline Test")
    print("=" * 60)

    # --- Test 1: Focused query ---
    print("\n1. FOCUSED MODE — Ticker: COKE")
    print("   Query: 'What are the key risks for this company?'")
    print("   Running...")

    try:
        result = query_focused(
            query="What are the key risks for this company?",
            ticker="COKE",
            history=[],
        )
        print(f"\n   ✅ Reply ({len(result['reply'])} chars):")
        print(f"   {result['reply'][:500]}...")
        print_docs(result["documents"], "Retrieved docs")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()

    # --- Test 2: Focused query (stock profile) ---
    print("\n2. FOCUSED MODE — Ticker: COKE")
    print("   Query: 'Why is this stock under-covered?'")
    print("   Running...")

    try:
        result = query_focused(
            query="Why is this stock under-covered?",
            ticker="COKE",
            history=[],
        )
        print(f"\n   ✅ Reply ({len(result['reply'])} chars):")
        print(f"   {result['reply'][:500]}...")
        print_docs(result["documents"], "Retrieved docs")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()

    # --- Test 3: Global query ---
    print("\n3. GLOBAL MODE")
    print("   Query: 'Which under-covered stocks have the highest activity scores?'")
    print("   Running...")

    try:
        result = query_global(
            query="Which under-covered stocks have the highest activity scores?",
            history=[],
        )
        print(f"\n   ✅ Reply ({len(result['reply'])} chars):")
        print(f"   {result['reply'][:500]}...")
        print_docs(result["documents"], "Retrieved docs (diversified)")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()

    # --- Test 4: Focused with history ---
    print("\n4. FOCUSED MODE WITH HISTORY — Ticker: COKE")
    print("   Query: 'Tell me more about that'")
    print("   Running...")

    try:
        result = query_focused(
            query="Tell me more about that",
            ticker="COKE",
            history=[
                {"role": "user", "content": "What are the key risks for this company?"},
                {"role": "assistant", "content": "The main risks include regulatory changes and competition."},
            ],
        )
        print(f"\n   ✅ Reply ({len(result['reply'])} chars):")
        print(f"   {result['reply'][:500]}...")
        print_docs(result["documents"], "Retrieved docs")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()

    print("=" * 60)
    print("Tests complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()