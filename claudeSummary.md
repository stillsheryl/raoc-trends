# Conversation Log — Community Voices Challenge Planning

---

## Message 1 — User

> *(Shared the original challenge brief: build an app that generates a
> "Community Voices Document" for an active online community, using RAG to
> empower generation, an automated ingestion pipeline, and an A/B comparison
> between a plain LLM and a RAG-grounded LLM.)*

**Plan submitted:**

- Community: Reddit r/RandomActsofCards, filtered to posts with `[Request]`
  (case-insensitive) in the title.
- React web app + Python backend in the same folder.
- Python app fetches data from the Reddit API and stores: `uuid`, `reddit_id`,
  `title`, `body`, `author`, `num_comments`, `url`, `created_on_reddit`,
  `ingested_at`.
- Generate embeddings using HuggingFace `bge-large-en-v1.5`.
- Store embeddings in PostgreSQL + pgvector, in a `post_embeddings` table
  (`post_id`, `embedding`).
- Run a small LLM classification pass (occasion, recipient, emotion, reason,
  confidence) and store occasion/recipient/emotion as their own fields, with
  the rest as JSON metadata, linked back to `post_id`.
- Fetch a month of data to get a meaningful trend.

**Question:** What do I think of this plan — missing anything, or is this a
good approach?

---

## Message 2 — Assistant

Gave feedback organized into three parts:

**What's strong:**
- Good community choice — active, with a clean signal (`[Request]` titles)
  and naturally structured fields (occasion, recipient, emotion).
- Sensible schema separation across `reddit_posts`, `post_embeddings`, and a
  classification table.
- pgvector is the right call — easy local setup, satisfies the
  "vectorized table in a relational database" requirement directly.
- All 5 numbered challenge requirements are addressed in the plan.

**Gaps flagged:**
1. **Retrieval stats (3c)** — the plan didn't yet include a way to track
   which embeddings get retrieved most. Suggested adding a `retrieval_count`
   column (or separate log table).
2. **Embedding visualization (3b)** — recommended actually building this
   (UMAP/PCA scatter colored by occasion/emotion) since it's high demo value
   and reuses existing data.
3. **Classification model choice unspecified** — suggested using an API-based
   model (e.g. Claude Haiku) with structured JSON output for speed/reliability
   given the time constraint, vs. a local zero-shot classifier as a slower
   alternative.
4. **Data volume sanity check** — suggested checking actual post volume
   before committing to a full month fetch, tying into requirement 4b
   ("ways to get around overly large amounts of data").
5. **Reddit API auth** — flagged that a registered Reddit app
   (client ID/secret) would be needed.
6. **A/B comparison UI** — suggested a concrete side-by-side dashboard view
   using the same prompt/output schema for both sides.

**Sequencing suggestion** (to ensure all 5 requirements are met at least at a
basic level before polishing):
1. Reddit ingestion → `reddit_posts`
2. Embeddings → `post_embeddings`
3. Bare-bones RAG retrieval + generation (A/B comparison working at minimum)
4. Classification metadata table
5. Dashboard polish (embedding viz, trend charts, retrieval stats)

---

## Message 3 — User

Asked for a simplified explanation of what happens **after** embeddings are
stored, following the suggested sequencing.

---

## Message 4 — Assistant

Broke the RAG pipeline into five simplified steps:

1. **Retrieval** — embed a query (e.g. "What has this community been
   requesting lately?") using the same BGE model, then run a cosine
   similarity search against `post_embeddings` via pgvector's `<=>` operator
   to pull back the top N most similar posts. This is also where retrieval
   stats get incremented.
2. **Augmentation** — stuff the retrieved posts' titles/bodies/metadata into
   a prompt as context.
3. **Generation** — send the augmented prompt to an LLM to produce the actual
   "what happened this week" + "prediction for next week" content.
4. **Plain LLM run (A/B baseline)** — send the same instruction with *no*
   retrieved context, to see how the LLM does without grounding.
5. **Side-by-side display** — dashboard shows Plain LLM output (left) vs.
   RAG-grounded output (right).

Closed with the mental model: RAG turns retrieval into an "open-book exam"
for the LLM instead of a "closed-book" one.

---

## Message 5 — User

Shared a refined, more concrete implementation plan (schema simplified,
includes the BGE query, the cosine SQL query, the cron job, the retrieval
stat columns living directly on `post_embeddings`, the A/B comparison
structure, and the embedding visualization panel). Asked for this to be
converted into a `.md` file to use as a guide for an AI coding assistant, and
to sanity-check that nothing important was missing.

---

## Message 6 — Assistant

Reviewed the refined plan before converting it, flagging:

1. `author` and `ingested_at` were dropped from the original schema —
   recommended keeping `ingested_at` since it separates "Reddit's created
   time" from "our pipeline's ingestion time," useful for debugging
   idempotency.
2. **Missing classification/metadata table** — the prompt example referenced
   `occasion: illness, emotion: hopeful` per post, but no step in the plan
   actually generated or stored that data. Recommended re-adding a
   `post_classifications` table and an LLM classification step.
3. Confirmed `retrieval_count`/`last_retrieved` living directly on
   `post_embeddings` was a reasonable simplification.
4. Noted that classification needs to happen during/after ingestion, before
   retrieval, since the prompt depends on it.

Created **`IMPLEMENTATION_PLAN.md`** containing:
- Overview
- Data Source & Scope (staged day → week → month fetch strategy)
- Database Schema (`reddit_posts`, `post_embeddings`, `post_classifications`)
- Ingestion Pipeline steps
- RAG Retrieval steps (with the cosine similarity SQL query)
- Prompt Augmentation & Generation
- A/B Comparison section
- Dashboard panel list
- Requirements Coverage Checklist mapping each challenge requirement to where
  it's addressed
- Open Decisions list (LLM choice, top-N value, whether to keep `author`)

---

## Message 7 — User

Stated that running the additional classification call is out of scope for
this project, and asked to remove it completely from the plan.

---

## Message 8 — Assistant

Removed the `post_classifications` table and all references to the
classification pass from `IMPLEMENTATION_PLAN.md`:

- Replaced the table section with a note explaining the classification step
  was considered but cut as out of scope, and that the RAG prompt will be
  built from raw `title`/`body` text only.
- Updated the Ingestion Pipeline (Step 3) to only generate embeddings, no
  classification call.
- Updated Prompt Augmentation (Step 5) to build context from raw title/body
  text only, dropping the occasion/emotion annotations from the example.
- Updated the Dashboard panel list (Step 7):
  - Trend charts panel changed from "trending occasions / sentiment" to
    post volume over time, recurring keywords from titles, and comment
    engagement trends (all derivable from `reddit_posts` alone).
  - Embedding visualization panel changed from coloring by occasion/emotion
    to coloring by k-means cluster id on the embeddings themselves (still
    satisfies requirement 3b, just unsupervised).
- Updated Open Decisions list to drop the classification LLM mention.

Flagged the two downstream effects of the cut (trend chart content and
embedding viz coloring) so they wouldn't be a surprise later, while
confirming schema, ingestion, retrieval, and the A/B comparison were all
unaffected.

---

## Message 9 — User

Asked for a markdown file of the entire conversation.

---

## Message 10 — Assistant

*(This document.)*