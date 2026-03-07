import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from rag.document_store import get_document_store

store = get_document_store()
print(f"Current count: {store.count_documents()}")

# Delete only sec_filing chunks, keep stock_profiles
sec_docs = store.filter_documents(
    filters={"field": "meta.source_type", "operator": "==", "value": "sec_filing"}
)
print(f"SEC filing chunks to delete: {len(sec_docs)}")

if sec_docs:
    doc_ids = [doc.id for doc in sec_docs]
    store.delete_documents(document_ids=doc_ids)

print(f"After cleanup: {store.count_documents()}")
print("✅ Done — stock profiles preserved, SEC chunks cleared")