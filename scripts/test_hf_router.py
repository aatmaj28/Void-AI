#!/usr/bin/env python3
"""
Test the new HuggingFace router endpoint for embeddings.
https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5
"""

import os
import time
import requests
import numpy as np
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

HF_TOKEN = os.getenv("HF_API_TOKEN", "")
MODEL = "BAAI/bge-small-en-v1.5"
URL = f"https://router.huggingface.co/hf-inference/models/{MODEL}"

headers = {"Content-Type": "application/json"}
if HF_TOKEN:
    headers["Authorization"] = f"Bearer {HF_TOKEN}"
    print(f"✅ Using HF token: {HF_TOKEN[:10]}...")
else:
    print("⚠️  No HF_API_TOKEN found — using unauthenticated (slower, rate-limited)")

# Test 1: Single text embedding
print("\n1. Single text embedding...")
start = time.time()
response = requests.post(
    URL,
    headers=headers,
    json={"inputs": "What are the key risks for this company?"},
    timeout=30,
)
elapsed = time.time() - start

if response.status_code == 200:
    embedding = response.json()
    if isinstance(embedding, list) and len(embedding) > 0:
        # Could be [[...]] or [...] depending on API
        vec = embedding[0] if isinstance(embedding[0], list) else embedding
        print(f"   ✅ Got embedding: {len(vec)} dimensions, took {elapsed:.2f}s")
        print(f"   First 5 values: {vec[:5]}")
    else:
        print(f"   ❌ Unexpected response format: {str(embedding)[:200]}")
else:
    print(f"   ❌ Error {response.status_code}: {response.text[:300]}")

# Test 2: Batch embedding (2 texts)
print("\n2. Batch embedding (2 texts)...")
start = time.time()
response = requests.post(
    URL,
    headers=headers,
    json={"inputs": [
        "Why is this stock under-covered?",
        "Which stocks have the highest gap scores?"
    ]},
    timeout=30,
)
elapsed = time.time() - start

if response.status_code == 200:
    embeddings = response.json()
    if isinstance(embeddings, list) and len(embeddings) == 2:
        vec1 = embeddings[0] if isinstance(embeddings[0], list) else embeddings
        print(f"   ✅ Got 2 embeddings: {len(vec1)} dims each, took {elapsed:.2f}s")
    else:
        print(f"   ❌ Unexpected format: {str(embeddings)[:200]}")
else:
    print(f"   ❌ Error {response.status_code}: {response.text[:300]}")

# Test 3: Verify dimensions match bge-small-en-v1.5 (should be 384)
print("\n3. Dimension check...")
response = requests.post(
    URL,
    headers=headers,
    json={"inputs": "test"},
    timeout=30,
)
if response.status_code == 200:
    embedding = response.json()
    vec = embedding[0] if isinstance(embedding[0], list) else embedding
    if len(vec) == 384:
        print(f"   ✅ Dimensions: 384 (matches local model)")
    else:
        print(f"   ❌ Dimensions: {len(vec)} (expected 384)")

# Test 4: Compare with local model
print("\n4. Comparing API vs local embeddings...")
try:
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    
    test_text = "What are the key risks for this company?"
    
    # Local embedding
    local_emb = model.encode([test_text], normalize_embeddings=True)[0]
    
    # API embedding
    resp = requests.post(URL, headers=headers, json={"inputs": test_text}, timeout=30)
    api_emb = np.array(resp.json()[0] if isinstance(resp.json()[0], list) else resp.json())
    # Normalize API embedding
    api_emb = api_emb / np.linalg.norm(api_emb)
    
    # Cosine similarity
    similarity = np.dot(local_emb, api_emb)
    print(f"   Cosine similarity: {similarity:.6f}")
    if similarity > 0.99:
        print(f"   ✅ Vectors are nearly identical — safe to mix API and local embeddings")
    elif similarity > 0.95:
        print(f"   ⚠️  Vectors are close but not identical — might cause minor retrieval differences")
    else:
        print(f"   ❌ Vectors are too different — do NOT mix API and local embeddings")
except ImportError:
    print("   (skipped — sentence-transformers not installed)")

print("\n✅ Test complete!")