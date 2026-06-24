# Community Voices Project - Conversation Summary

## Overview

This document summarizes the planning discussion for a Community Voices Challenge project focused on building a RAG-powered application that analyzes community discussions and generates weekly summaries and predictions.

---

# Initial Project Idea

The goal is to create a web application that generates a **Community Voices Document** describing:

1. What a community discussed during the previous week
2. What the community is likely to discuss during the upcoming week

The chosen community is:

**r/RandomActsofCards**

https://www.reddit.com/r/RandomActsofCards/

The focus is specifically on posts that contain:

```text
[Request]
```

in the title (case-insensitive).

Example filter:

```python
"[request]" in title.lower()
```

---

# Recommended Architecture

A simple architecture was recommended:

```text
Reddit API
    ↓
Data Ingestion
    ↓
PostgreSQL + pgvector
    ↓
RAG Retrieval
    ↓
LLM Generation
    ↓
React Dashboard
```

Suggested technology stack:

Frontend:

* React
* TypeScript

Backend:

* Python
* FastAPI

Database:

* PostgreSQL
* pgvector

Embeddings:

* BAAI/bge-large-en-v1.5

---

# Initial Database Design Discussion

The original proposal included storing Reddit data such as:

```text
id
title
body/selftext
author
created_at
score
num_comments
url
```

Question raised:

> Should these fields be stored in JSON or in database columns?

Recommendation:

Store commonly queried Reddit fields as database columns.

Example:

```sql
reddit_posts
------------
id
reddit_id
title
body
created_at
num_comments
url
```

Reasoning:

These fields are frequently filtered, sorted, and analyzed.

JSON was suggested only for flexible future metadata.

---

# Metadata Extraction Discussion

An idea was proposed to classify requests into categories such as:

```json
{
  "occasion": "birthday",
  "recipient": "grandmother",
  "emotion": "joy",
  "urgency": "low"
}
```

Potential categories included:

* Birthday
* Illness
* Sympathy
* Graduation
* Wedding
* Holiday
* Encouragement
* Pet Loss

Potential emotions:

* Joy
* Grief
* Hope
* Gratitude

Recommendation:

Do **not** build metadata extraction initially.

Because the assignment is time-constrained, metadata extraction was moved to a stretch goal.

The recommendation was:

1. Build the RAG pipeline first.
2. Add metadata later if time remains.

---

# Simplification Discussion

A major question was:

> Can the project start with only embeddings and RAG, then add metadata later?

Recommendation:

Yes.

The simplified MVP should consist of:

```text
Reddit Ingestion
        ↓
Embeddings
        ↓
pgvector Storage
        ↓
Retrieval
        ↓
Community Voices Generation
        ↓
A/B Comparison
```

This was considered sufficient to satisfy most assignment requirements.

Metadata extraction was identified as optional.

---

# Vector Storage Discussion

Recommended schema:

```sql
post_embeddings
---------------
post_id
embedding
retrieval_count
last_retrieved
```

Important correction:

Originally the embedding dimension was listed as:

```text
1536
```

This was corrected because:

```text
bge-large-en-v1.5
```

produces:

```text
1024-dimensional embeddings
```

Therefore:

```sql
VECTOR(1024)
```

should be used.

---

# Retrieval Analytics Discussion

One assignment requirement suggested:

> Keep stats on which embeddings get retrieved most often.

Recommendation:

Track retrieval activity directly in the embeddings table.

Example:

```sql
retrieval_count
last_retrieved
```

Each time a document is returned from vector search:

```text
retrieval_count += 1
last_retrieved = NOW()
```

This satisfies the requirement while keeping implementation simple.

---

# RAG Workflow Discussion

The proposed retrieval query:

```text
What has this community been requesting lately?
```

Steps:

1. Generate embedding for the query
2. Compare against stored embeddings
3. Retrieve top N results using cosine similarity
4. Feed results into the LLM as context

Example prompt:

```text
Here are recent requests from r/RandomActsofCards:

1. [Request] Mom going through chemo...
2. [Request] First Father's Day without my dad...
3. ...

Summarize what the community has been requesting this week and predict what they will likely request next week.
```

The LLM then generates:

* Weekly summary
* Major themes
* Community sentiment
* Prediction for next week

---

# Prediction Discussion

Concern:

> How should predictions be generated?

Recommendation:

Keep it simple.

For the assignment:

* Retrieve recent request posts
* Ask the LLM to summarize themes
* Ask the LLM to predict likely future requests

More advanced trend analysis was discussed but intentionally deferred.

---

# Automated Ingestion Discussion

The assignment requires:

> Create an automated way to fill the vector store.

Recommendation:

Use a scheduled process such as:

* Cron job
* GitHub Actions
* Scheduled Python script

Workflow:

```text
Fetch Posts
      ↓
Filter Requests
      ↓
Generate Embeddings
      ↓
Store in Database
```

The ingestion process should be idempotent.

Recommendation:

Use:

```text
reddit_id
```

as a unique identifier.

---

# Data Volume Discussion

Concern:

> How much Reddit data should be ingested?

Recommendation:

Start small.

Test:

1. One day
2. One week
3. One month

Then determine which timeframe provides meaningful trends.

The community is relatively small, so data volume is unlikely to become a major issue.

---

# Embedding Visualization Discussion

Assignment requirement:

> Consider showing a flattened visualization of embeddings.

Recommendation:

Use:

* UMAP (preferred)
* PCA
* t-SNE

Process:

```text
1024 dimensions
      ↓
2 dimensions
```

Display as a scatter plot.

Purpose:

Show clusters of similar request types.

This was considered a valuable feature because it demonstrates understanding of embeddings visually.

---

# A/B Testing Discussion

Assignment requirement:

> Compare an LLM with and without RAG.

Recommended implementation:

## Version A

Plain LLM

Prompt:

```text
Summarize what r/RandomActsofCards has been requesting lately and predict what they will request next week.
```

No context provided.

Expected result:

* Generic
* Hallucination-prone
* Less community-specific

---

## Version B

RAG-Enhanced

Prompt includes retrieved Reddit posts.

Expected result:

* Grounded in actual community discussions
* More specific
* More accurate

---

# Dashboard Design Discussion

Recommended dashboard sections:

## Community Voices Comparison

Left side:

* Plain LLM output

Right side:

* RAG output

Purpose:

Demonstrate A/B comparison visually.

---

## Retrieval Analytics

Display:

* Most retrieved posts
* Retrieval counts
* Recent retrieval activity

Purpose:

Demonstrate RAG observability.

---

## Embedding Visualization

Display:

* UMAP/PCA scatter plot

Purpose:

Demonstrate embedding clustering.

---

# Scope Reduction Discussion

Because the assignment explicitly states:

> No need to work on this for more than a couple hours.

A strong recommendation was made to reduce scope.

Final recommended build order:

1. Reddit ingestion
2. Embedding generation
3. pgvector storage
4. Retrieval
5. Community Voices generation
6. A/B comparison

Optional enhancements:

7. Embedding visualization
8. Retrieval analytics
9. Metadata extraction

---

# Final Recommendation

Focus on delivering a working RAG system rather than a perfect analytics platform.

The minimum viable version should demonstrate:

* Automated Reddit ingestion
* Embedding generation
* Vector storage
* Retrieval-augmented generation
* Community Voices document creation
* Plain LLM vs RAG comparison

This satisfies nearly every assignment requirement while remaining achievable within the project's time constraints.
