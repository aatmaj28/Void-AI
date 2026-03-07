"""
Test that Haystack's PgvectorDocumentStore connects and creates its table.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from rag.document_store import get_document_store
from haystack import Document

# 1. Connect and auto-create table
print("Connecting to PgvectorDocumentStore...")
store = get_document_store()
print(f"✅ Connected. Table: haystack_documents")

# 2. Check current count
count = store.count_documents()
print(f"✅ Current document count: {count}")

# 3. Write a test document
test_doc = Document(
    content="This is a test chunk for Kronos Worldwide.",
    embedding=[0.0] * 384,
    meta={
        "ticker": "KRO",
        "source_type": "test",
        "form_type": "10-K",
        "section": "test",
        "filing_date": "2024-01-01"
    }
)

from haystack.document_stores.types import DuplicatePolicy
store.write_documents([test_doc], policy=DuplicatePolicy.OVERWRITE)
print(f"✅ Wrote test document. New count: {store.count_documents()}")

# 4. Filter by ticker (this is how focused mode will work)
results = store.filter_documents(
    filters={"field": "meta.ticker", "operator": "==", "value": "KRO"}
)
print(f"✅ Filter by ticker=KRO returned {len(results)} docs")

# 5. Clean up test doc
test_docs = store.filter_documents(
    filters={"field": "meta.source_type", "operator": "==", "value": "test"}
)
doc_ids = [doc.id for doc in test_docs]
store.delete_documents(document_ids=doc_ids)
print(f"✅ Cleaned up test doc. Final count: {store.count_documents()}")

print("\n✅ All checks passed — document store is ready!")