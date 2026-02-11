-- Phase 4 RAG: SEC documents and chunks with pgvector embeddings (Mistral embed = 1024 dims)
CREATE EXTENSION IF NOT EXISTS vector;

-- One row per SEC filing (10-K / 10-Q)
CREATE TABLE sec_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(10) NOT NULL,
    form_type VARCHAR(10) NOT NULL,
    filing_date DATE NOT NULL,
    source_url TEXT,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (ticker, form_type, filing_date)
);

CREATE INDEX idx_sec_documents_ticker ON sec_documents(ticker);
CREATE INDEX idx_sec_documents_filing_date ON sec_documents(filing_date DESC);

COMMENT ON TABLE sec_documents IS 'One row per SEC 10-K/10-Q filing; source for RAG chunks';

-- One row per text chunk with embedding (Mistral embed outputs 1024 dimensions)
CREATE TABLE sec_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES sec_documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1024),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sec_chunks_document_id ON sec_chunks(document_id);
CREATE INDEX idx_sec_chunks_embedding ON sec_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE sec_chunks IS 'Text chunks from SEC filings with embeddings for similarity search';
