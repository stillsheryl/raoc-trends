"""Local embedding generation using BAAI/bge-large-en-v1.5.

The model is loaded lazily so that importing this module (e.g. for the API or
tests) does not force the ~1.3GB model download until embeddings are actually
needed.
"""

from functools import lru_cache

import numpy as np

from app.config import settings

# BGE retrieval models expect this instruction prefixed to *queries* only.
# Documents are embedded as-is. See the model card for details.
QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "


@lru_cache(maxsize=1)
def _get_model():
    # Imported lazily to keep startup fast and avoid the heavy torch import
    # for code paths that never embed anything.
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(settings.embedding_model)


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed post text for storage. Returns L2-normalized vectors."""
    if not texts:
        return []
    model = _get_model()
    vectors = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return np.asarray(vectors, dtype=np.float32).tolist()


def embed_query(query: str) -> list[float]:
    """Embed the fixed analysis query (with BGE instruction prefix)."""
    model = _get_model()
    vector = model.encode(
        QUERY_INSTRUCTION + query,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return np.asarray(vector, dtype=np.float32).tolist()
