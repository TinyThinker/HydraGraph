import { PERSONA_PRESETS } from './personaPresets'

/**
 * Canned transcript for the no-key demo tree.
 *
 * Pure data — no store, no Dexie, no ids that collide with real trees (every id
 * is `demo-*`). `src/lib/demoTree.ts` turns these turns into `TurnNode` rows:
 * it derives `childrenIds` from `parentId`, runs the real layout, and computes
 * token counts from this text so the cost receipt is arithmetic over what you
 * can actually read, not invented numbers.
 *
 * Every `model` here must exist in `BUNDLED_CATALOG` (`src/lib/bundledCatalog.ts`)
 * — the demo runs with no API key, so the bundled snapshot is the only catalog
 * available and an unpriced turn would show as excluded on the receipt.
 * `demoTree.test.ts` enforces that.
 */

export interface DemoTurn {
  id: string
  parentId: string | null
  /** OpenRouter slug; must be present in BUNDLED_CATALOG. */
  model: string
  /** Written to `systemPromptOverride`; cascades to descendants. */
  persona?: string
  prompt: string
  response: string
}

export const DEMO_TREE_TITLE = 'Demo · Metrics pipeline at 40k events/sec'

export const DEMO_SYSTEM_PROMPT =
  'You are a staff-level infrastructure engineer. Be concrete and quantitative. ' +
  'Name the tradeoff you are making rather than hiding it.'

const persona = (label: string): string => {
  const preset = PERSONA_PRESETS.find((p) => p.label === label)
  if (!preset) throw new Error(`Demo tree references unknown persona preset: ${label}`)
  return preset.prompt
}

const TRUNK = 'anthropic/claude-3.5-sonnet'

export const DEMO_TURNS: DemoTurn[] = [
  {
    id: 'demo-01',
    parentId: null,
    model: TRUNK,
    prompt:
      "I'm designing the ingest and storage path for a multi-tenant metrics service. Constraints: 40k events/sec at peak, 1,200 tenants, p99 under 400 ms for any query over the last 6 hours, 13-month retention, single region, hard ceiling of $8k/month for the whole pipeline. Before we touch technology — which decisions here can't we walk back?",
    response: `Four of them are load-bearing. The rest you can change in an afternoon.

**1. The partition key.** Changing it later means rewriting every byte you've stored. At 13 months that's a migration measured in weeks, not hours.

**2. What you keep per event.** Dropping a dimension is easy; adding one retroactively is impossible — the data never existed. Decide now which labels are worth 13 months of disk.

**3. Where aggregation happens.** Roll up at ingest and queries get cheap but you can never re-slice history. Roll up at query time and you keep every option and pay for it on every dashboard load.

**4. The deletion story.** "Delete tenant 84" has to be a structural operation. If it's a \`WHERE\` clause scanning 13 months, you will miss your own SLA the first time someone invokes it.

### Why the budget forces your hand

40,000 events/sec is 3.46B events/day, ~1.37T events over 395 days. Even at a well-compressed 20 bytes/row that's ~27 TB. Block storage alone runs ~$2.2k/month — over a quarter of your ceiling before a single CPU is billed.

So the shape is already decided: **raw data has a short life, rollups have the long one.** The only open question is how many tiers and at what resolutions.

The tradeoff I'm making: I'm optimising for the 6-hour query and treating 13-month reads as coarse and rare. If anyone expects to run ad-hoc per-endpoint queries against month 11, say so now — it changes all four answers.`,
  },
  {
    id: 'demo-02',
    parentId: 'demo-01',
    model: TRUNK,
    prompt:
      'Storage engine, then. We already run Postgres and Kafka in production, and nobody on the team has operated Cassandra or a JVM cluster. Does that rule anything out?',
    response: `Yes, and it's the useful kind of constraint — it eliminates the two options that would have cost you a quarter.

**Out: Cassandra / Mimir / anything JVM-clustered.** Not on technical merit; on operational reality. Both want someone who has felt a compaction storm at 3am. Learning that on a service with an SLA is how teams end up rewriting.

**Out: Postgres + TimescaleDB, at this volume.** It survives 3.46B rows/day on paper. In practice a single writer node at 40k rows/sec sustained, with 13 months of chunks and per-chunk indexes, becomes a full-time job. Timescale is the right answer at 4k events/sec, not 40k.

**In: ClickHouse.** It's the only option that fits all three of your constraints at once:

- Columnar compression takes that 27 TB estimate closer to 8–12 TB raw, and rollup tables to a few hundred GB.
- \`MergeTree\` sustains 40k rows/sec on hardware you can afford, given batched inserts.
- Materialized views do ingest-time rollups without a separate stream-processing tier — which keeps Kafka as a buffer rather than making it a compute platform.

You already have the Kafka half: producers → Kafka → batched \`INSERT\` into ClickHouse. Batch at 10–20k rows or 1 second, whichever comes first.

**What I'm not going to pretend.** ClickHouse's operational surface is real, just different: you'll learn part counts and merge pressure instead of compaction. No per-row updates — deletes are asynchronous mutations, which collides directly with your 24-hour deletion requirement. Flag that; we come back to it.

For 1,200 tenants and this budget, start with 3 nodes and no replication of the raw tier. Replicate only the rollups — they're small, and they're what you can't rebuild.`,
  },
  {
    id: 'demo-03',
    parentId: 'demo-02',
    model: TRUNK,
    prompt:
      'ClickHouse then. Our label cardinality is ugly: tenant_id × service × endpoint × status_code, and `endpoint` is user-supplied so it is effectively unbounded. What breaks first?',
    response: `Not disk. Disk is the thing people worry about and it's fine — compression loves repeated low-entropy strings.

**What breaks first is \`GROUP BY\` memory on the 6-hour query.** A dashboard asking "p99 by endpoint for this tenant, last 6 hours" builds a hash table proportional to distinct endpoints in the range. One tenant with a path-parameterised route — \`/orders/7f3a…\` — generates a fresh series per request. A single bad tenant turns a 40 ms query into an OOM, for everyone, because they share the node.

The order things fail, in practice:

1. **Query memory** — one tenant's unbounded endpoints kill unrelated queries. Weeks away, not months.
2. **Sparse index selectivity** — with \`endpoint\` high in the sort key, the primary index stops pruning granules and every query degrades toward a scan.
3. **Part count / merge pressure** — many distinct label combinations per insert batch means wider parts and more merging. Shows up as insert latency creep, then \`TOO_MANY_PARTS\`.
4. **Disk** — last, and by then you already have a problem.

### The fix is upstream of storage

Normalise \`endpoint\` at ingest, not at query. Two mechanisms:

- **Path templating**: collapse UUIDs, ints, and hex segments to \`:id\`. \`/orders/7f3a…/items/12\` → \`/orders/:id/items/:id\`. This alone typically cuts endpoint cardinality by 100×+.
- **A per-tenant series budget**: count distinct series per tenant per hour. Above the budget, new series land in an \`__over_budget__\` bucket and the tenant gets told.

With templating I'd expect you to land near 400k active series across all tenants. That number is the one every capacity estimate below depends on, so measure it in week one rather than trusting me.

The tradeoff: templating is lossy and irreversible. You can never ask "which specific order ID was slow" from metrics again — that question moves to traces or logs, where it belonged anyway.`,
  },
  {
    id: 'demo-03b',
    parentId: 'demo-03',
    model: 'openai/gpt-4o-mini',
    prompt:
      'Side branch before we continue: suppose we skip templating and just reject new endpoints above a per-tenant quota. What does that cost us in product terms, not engineering terms?',
    response: `Rejecting above a quota is cheaper to build, but the cost lands on your users instead of your cluster:

- **Silent blind spots.** The endpoint that matters during an incident is often the new one. A quota means the data you need is the data you dropped.
- **Non-deterministic gaps.** Whichever endpoints arrive first in the hour survive; the rest vanish. Two tenants with identical traffic get different dashboards, and neither can explain why.
- **A support-ticket class you can't close.** "My endpoint is missing" has no satisfying answer beyond "you exceeded an internal limit."
- **Dashboards that lie by omission.** A panel built on a quota-dropped series goes flat instead of erroring, which reads as "traffic stopped" rather than "we stopped recording."
- **Contract risk.** If a quota is a real product limit, it belongs in the pricing page, and then it becomes something sales negotiates.

If you do go this way, soften it:

1. Route overflow into an \`__other__\` bucket so totals stay correct even when the breakdown doesn't.
2. Surface the quota in the tenant's own UI with current usage — a visible limit is a feature, a hidden one is a bug.
3. Alert the tenant when they cross 80%.

Templating plus a generous quota is the combination most teams end up at: templating removes the accidental cardinality, the quota catches the deliberate kind.`,
  },
  {
    id: 'demo-04',
    parentId: 'demo-03',
    model: TRUNK,
    prompt:
      'Back to the main line. Give me a rollup plan that keeps 6-hour queries under 400 ms and 13 months affordable. Numbers, not shapes.',
    response: `Assuming ~400k active series after templating. Four tiers, each written by a materialized view off the tier above:

| Tier | Resolution | Retention | Rows | Compressed |
|---|---|---|---|---|
| Raw events | per event | 24 h | 3.46B | ~40 GB |
| \`m_1m\` | 1 minute | 7 d | 4.0B | ~48 GB |
| \`m_5m\` | 5 minutes | 30 d | 3.5B | ~42 GB |
| \`m_1h\` | 1 hour | 395 d | 3.8B | ~46 GB |

**~180 GB total.** That's the whole point of the exercise: 27 TB of raw retention becomes 180 GB, and your storage line goes from ~$2.2k/month to under $20.

### Which tier answers the 6-hour query

\`m_1m\` — 360 points per series, and with the sort key pruning to one tenant you're reading single-digit MB. Expect 30–80 ms, not 400. The 400 ms budget is spent almost entirely on tenants querying *across* services, so benchmark that shape first.

Never let a dashboard hit the raw table. Raw exists for two things: feeding the 1-minute view, and 24 hours of "what exactly happened at 14:32" forensics.

### Store aggregates, not averages

Each rollup row keeps \`count\`, \`sum\`, \`min\`, \`max\`, and a quantile sketch state (\`quantilesTDigestState\`). Storing a precomputed p99 per minute is the classic mistake — p99s don't average, and every "p99 across these five services" panel becomes a lie you can't detect.

### The honest cost

Ingest CPU roughly doubles: every event now feeds four writes instead of one. At this volume that's still comfortably inside 3 nodes, and it's the right trade — you're moving cost from every query to one write.

The number to distrust here is 400k series. If templating leaves you at 4M, multiply every row count by 10 and the plan still holds; at 40M, the 1-minute tier stops being affordable and 5-minute becomes your finest retained grain.`,
  },
  {
    id: 'demo-05a',
    parentId: 'demo-04',
    model: 'meta-llama/llama-3.3-70b-instruct',
    prompt:
      'Decision time, and I want the disagreement. Do we partition by tenant or by time? 1,200 tenants, the largest is 40% of all volume, and a deletion request must be provably complete within 24 hours. Pick one, then argue against your own pick.',
    response: `**Recommendation: partition by tenant.**

Given your deletion requirement, tenant partitioning is the natural fit:

- **Deletion becomes structural.** Dropping a tenant is a \`DROP PARTITION\` — effectively instant, and easy to prove.
- **Isolation.** One tenant's queries touch only their own partitions, so a heavy user is less likely to affect others.
- **Simpler reasoning.** Per-tenant retention or resolution policies become straightforward.
- **Clear ownership.** Capacity and cost attribution per tenant fall out of the layout.

### Arguing against my own pick

- **Time-range queries get harder.** A query spanning several tenants has to touch many partitions, which adds overhead.
- **Uneven partitions.** With one tenant at 40% of volume, partition sizes will be very unbalanced.
- **Retention is less natural.** Ageing out old data is more convenient when partitions are time-based.
- **Management overhead.** 1,200 partitions is a lot of objects to keep track of.

### Suggested middle ground

A composite scheme — partition by tenant and then by time within each tenant — gives you both structural deletes and time-based retention. You could also consider separating the largest tenants into their own tables.

Both approaches are defensible, and the right answer depends on your access patterns. If deletion speed and isolation are the priority, tenant partitioning is the safer choice; if retention management and cross-tenant analytics dominate, time partitioning wins. I would benchmark both with representative data before committing.`,
  },
  {
    id: 'demo-05b',
    parentId: 'demo-04',
    model: 'openai/gpt-4o',
    prompt:
      'Decision time, and I want the disagreement. Do we partition by tenant or by time? 1,200 tenants, the largest is 40% of all volume, and a deletion request must be provably complete within 24 hours. Pick one, then argue against your own pick.',
    response: `**Partition by time. Weekly. Put \`tenant_id\` first in the sort key, not the partition key.**

\`\`\`sql
PARTITION BY toMonday(ts)
ORDER BY (tenant_id, service, endpoint, ts)
\`\`\`

### Why time wins

1. **Retention is a partition drop.** TTL expiry removes whole partitions — no mutations, no merge amplification.
2. **Partition count stays sane.** 57 weekly partitions per table per year. Tenant partitioning gives you 1,200 × 57 ≈ 68k partitions per table, which is well past what ClickHouse is comfortable with.
3. **You keep tenant pruning anyway.** With \`tenant_id\` leading the sort key, the sparse index skips other tenants' granules. You get most of the isolation benefit without paying the partition-count cost.
4. **Ingest stays cheap.** Each insert batch touches one or two partitions instead of scattering across hundreds, which keeps parts large and merges quiet.

### Deletion under a 24-hour SLA

\`\`\`sql
ALTER TABLE events DELETE WHERE tenant_id = 84;
\`\`\`

This is an asynchronous mutation: ClickHouse rewrites every part containing that tenant. Across 180 GB of rollups plus the raw tier it typically completes in hours, comfortably inside 24 — but it is I/O-heavy, so schedule it off-peak and track \`system.mutations\` until \`is_done = 1\`. That row is your audit evidence.

### Arguing against my own pick

- **Mutations are not instant and not free.** A \`DROP PARTITION\` is provable in seconds; a mutation is a job you have to monitor. If your SLA tightened to one hour, my answer would change.
- **Merges rewrite deleted data.** Until the mutation finishes, deleted rows still exist on disk. "Provably complete" needs a definition both you and the customer accept.
- **The 40% tenant is a real problem.** They will dominate every partition they touch, and their merges become everyone's merges. A dedicated table for them is worth considering.

**Verdict:** weekly time partitions, \`tenant_id\`-leading sort key, mutations for deletion with a monitored completion record. Revisit if the deletion SLA drops below a few hours.`,
  },
  {
    id: 'demo-05c',
    parentId: 'demo-04',
    model: 'anthropic/claude-3.7-sonnet',
    prompt:
      'Decision time, and I want the disagreement. Do we partition by tenant or by time? 1,200 tenants, the largest is 40% of all volume, and a deletion request must be provably complete within 24 hours. Pick one, then argue against your own pick.',
    response: `**Time, weekly — except for the whale, which gets its own partition scheme. This is not a compromise; it's the only split that survives all three of your constraints.**

### Why pure tenant partitioning is fatal here

Run the arithmetic before the argument. 1,200 tenants × 57 weeks × 4 tables ≈ **274k parts minimum**, before merges. ClickHouse starts complaining in the low thousands per table and refuses inserts at \`parts_to_throw_insert\` (300 per partition by default). Tenant partitioning isn't "harder to manage" — it doesn't run. Any answer that presents it as a balanced tradeoff hasn't multiplied the numbers.

### Why the 40% tenant changes the design

This is the detail that makes the standard answer wrong. Your largest tenant is not a heavy user; they are the workload, and everyone else is noise around them.

- Every weekly partition is ~40% one tenant. Their backfills, their traffic spikes, their deletion — each becomes a cluster-wide merge event.
- Their granules sit interleaved with 1,199 other tenants', so a small-tenant query reads index entries mostly about the whale.
- When they eventually ask to be deleted, you are rewriting 40% of everything you own, under a 24-hour clock.

So: **whale tenants (>5% of volume) get their own tables, partitioned by \`(tenant_id, month)\`.** That's 13 partitions per whale per year — trivially manageable, and their deletion becomes a \`DROP PARTITION\` measured in seconds. Route at the ingest layer through a small table mapping \`tenant_id → shard\`; queries read the same mapping.

### Deletion, stated precisely enough to defend

| Tenant class | Mechanism | Time to provable completion |
|---|---|---|
| Whale (own tables) | \`DROP PARTITION\` × 13 | seconds, verifiable by absence of the part |
| Everyone else | \`ALTER TABLE … DELETE WHERE tenant_id = N\` | hours; \`system.mutations.is_done\` is the receipt |

Add a verification query after each — \`SELECT count() FROM table WHERE tenant_id = N\` returning 0 across all four tiers — and store its result with a timestamp. That record, not the mutation itself, is what satisfies an auditor.

### The strongest objection to my own answer

**Two code paths is a permanent tax.** Every query, every migration, every backfill now has a whale case and a normal case, and the day someone forgets, a tenant silently returns no data. That's a real ongoing cost and I'm accepting it deliberately, because the alternatives are worse: one path that can't meet the deletion SLA for your biggest customer, or a partition count that won't accept inserts.

The second objection is sharper: **tenant volume is not static.** A 3% tenant that grows into 8% needs to move between schemes, live, and I don't have a no-outage procedure for that yet. Until that procedure exists, this design has a known hole — and it will be tested by your fastest-growing customer, which is exactly the one you least want to disrupt.`,
  },
  {
    id: 'demo-06',
    parentId: 'demo-05c',
    model: TRUNK,
    prompt:
      'Take your split — whale isolated, everyone else in shared weekly partitions. Write the DDL and the retention statements, and tell me which query shape to benchmark first.',
    response: `\`\`\`sql
-- Shared tier: 1,199 tenants, weekly partitions.
CREATE TABLE events_shared
(
    tenant_id   UInt32,
    service     LowCardinality(String),
    endpoint    String,              -- already templated at ingest
    status      UInt16,
    ts          DateTime64(3),
    duration_ms Float32
)
ENGINE = MergeTree
PARTITION BY toMonday(ts)
ORDER BY (tenant_id, service, endpoint, ts)
TTL toDateTime(ts) + INTERVAL 24 HOUR;

-- Whale tier: same columns, monthly partitions keyed by tenant.
CREATE TABLE events_whale AS events_shared
ENGINE = MergeTree
PARTITION BY (tenant_id, toYYYYMM(ts))
ORDER BY (tenant_id, service, endpoint, ts)
TTL toDateTime(ts) + INTERVAL 24 HOUR;

-- 1-minute rollup: the tier dashboards actually read.
CREATE TABLE m_1m
(
    tenant_id UInt32,
    service   LowCardinality(String),
    endpoint  String,
    status    UInt16,
    bucket    DateTime,
    count     UInt64,
    sum_ms    Float64,
    max_ms    Float32,
    q_state   AggregateFunction(quantilesTDigest(0.5, 0.95, 0.99), Float32)
)
ENGINE = AggregatingMergeTree
PARTITION BY toMonday(bucket)
ORDER BY (tenant_id, service, endpoint, bucket)
TTL bucket + INTERVAL 7 DAY;

CREATE MATERIALIZED VIEW mv_1m_shared TO m_1m AS
SELECT
    tenant_id, service, endpoint, status,
    toStartOfMinute(ts) AS bucket,
    count()                                         AS count,
    sum(duration_ms)                                AS sum_ms,
    max(duration_ms)                                AS max_ms,
    quantilesTDigestState(0.5, 0.95, 0.99)(duration_ms) AS q_state
FROM events_shared
GROUP BY tenant_id, service, endpoint, status, bucket;
\`\`\`

\`m_5m\` and \`m_1h\` follow the same pattern, each reading from the tier above and keeping \`quantilesTDigestMergeState\` so sketches compose instead of being recomputed from lost detail. Point an identical \`mv_1m_whale\` at \`events_whale\`.

### Benchmark this first

Not the single-tenant panel — that one is fast and will flatter you. Benchmark the shape that *fights the sort key*:

\`\`\`sql
SELECT service, quantilesTDigestMerge(0.99)(q_state)
FROM m_1m
WHERE tenant_id = 84
  AND bucket >= now() - INTERVAL 6 HOUR
GROUP BY service
ORDER BY 2 DESC;
\`\`\`

Then run the version without the \`tenant_id\` predicate — the internal "worst p99 across all tenants" view someone will inevitably build. That query reads every granule in the range and is where your 400 ms budget dies. Knowing its real number now decides whether cross-tenant views need their own pre-aggregated table.`,
  },
  {
    id: 'demo-07a',
    parentId: 'demo-06',
    model: TRUNK,
    persona: persona('Skeptic'),
    prompt:
      'Review that DDL as written. What will hurt in production, and when does it show up?',
    response: `Five things, in the order they'll bite.

**1. The 400k series figure is a guess that is now load-bearing.** Every capacity number in this design descends from it, and it came from a sentence containing "I'd expect." If templating leaves you at 4M series, \`m_1m\` is 480 GB rather than 48 and the 7-day retention becomes the first thing you cut. *Shows up: week two, the moment real traffic lands.*

**2. \`ORDER BY (tenant_id, …)\` optimises the query you described and penalises the one you'll build.** Every cross-tenant view — internal SLO dashboards, "who is slowest", capacity planning — scans everything. You noted it and moved on. The weakest link isn't the schema, it's that nobody has costed the internal query pattern at all. *Shows up: the first internal dashboard, ~month one.*

**3. The whale threshold is a constant with no owner.** ">5% of volume" is checked by what, on what schedule, and who acts on it? An unowned threshold is a threshold that silently stops being true. The design's own stated hole — tenants crossing the boundary — has no detection mechanism, let alone a procedure. *Shows up: whenever your fastest-growing tenant crosses it, and you find out from a merge alert.*

**4. TTL deletes are not free, and the raw tier's 24-hour TTL is the heaviest one.** You're dropping ~40 GB/day continuously while sustaining 40k inserts/sec into the same parts. TTL merges compete with insert merges. This is exactly the interaction that produces \`TOO_MANY_PARTS\` at 3am. *Shows up: under peak load, not under test load.*

**5. "Under 400 ms" has never been measured on this hardware with this data.** Every latency number so far has been an estimate presented with two significant figures. The demanded evidence is one afternoon with generated data at 10× your series estimate.

**What I'd actually challenge.** The design is coherent. My objection is that its three most important numbers — series count, whale threshold, cross-tenant query cost — are all assumptions wearing the costume of measurements. Before writing more SQL, generate synthetic data at 4M series and run the two queries from the previous turn. If they hold, this design is sound. If they don't, you've saved a quarter.`,
  },
  {
    id: 'demo-07b',
    parentId: 'demo-06',
    model: TRUNK,
    persona: persona('Security Auditor'),
    prompt:
      'Review that DDL as written. What will hurt in production, and when does it show up?',
    response: `Read as a trust boundary, this schema has one: the \`tenant_id\` predicate in each query. That's thin.

**1. Tenant isolation is a \`WHERE\` clause.** Nothing structural prevents a query from returning another tenant's rows — one bug in query assembly, one missing predicate on a new endpoint, and you have a cross-tenant disclosure with no trace in the data layer. Enforce it below the application: a ClickHouse row policy per tenant role, or a query-generation layer that cannot emit a statement without a bound \`tenant_id\`. Never string-interpolate a tenant id.

**2. \`endpoint\` is user-supplied, unbounded \`String\`, retained 13 months.** Path segments routinely carry emails, tokens, and account ids. Templating collapses \`/users/7f3a…\` to \`/users/:id\` but does nothing for \`/reset?token=…\` or \`/invite/user@example.com\`. You are one week from PII in a metrics store that has no deletion story for *fields*, only for tenants. Enforce a length cap, strip query strings at ingest, and treat the templater as a security control with tests — not a cardinality optimisation.

**3. The deletion claim outruns its evidence.** \`system.mutations.is_done = 1\` proves the mutation finished; it does not prove the rows are gone from every replica, from backups, or from the materialized views' source tier. "Provably complete within 24 hours" needs: a per-tier verification count, an explicit statement about backup retention, and an immutable audit record. Right now backups are unmentioned, which in practice means deleted tenant data lives on in snapshots.

**4. Materialized views bypass whatever you enforce on the source tables.** Row policies on \`events_shared\` do not apply to \`m_1m\`. Every tier needs the same controls, or the rollups become the easy path around them.

**5. The whale routing table is an unguarded control plane.** A wrong row there sends a tenant's writes to the wrong shard — a silent cross-tenant write, the worst failure in this design. It needs write-restriction, an audit log, and a consistency check that reads back what ingest actually did.

**When it shows up:** #2 is already true if you have any auth endpoints. #1 and #4 surface at the first security review or the first customer questionnaire asking how isolation is enforced. #3 surfaces the first time a real deletion request arrives with a lawyer attached.`,
  },
  {
    id: 'demo-07b2',
    parentId: 'demo-07b',
    model: TRUNK,
    prompt:
      'Fair. Give me the deletion verification artefact — what we run, what we store, and what we can honestly tell a customer.',
    response: `### What you run, per tenant, per tier

\`\`\`sql
-- After the DROP PARTITION (whale) or mutation (shared), for each of the
-- four tiers plus any replica:
SELECT
    '__TIER__'        AS tier,
    hostName()        AS host,
    count()           AS remaining_rows,
    now()             AS verified_at
FROM __TIER__
WHERE tenant_id = 84
SETTINGS max_execution_time = 60;
\`\`\`

Run it on every replica, not just the one you're connected to. A mutation that completed on two of three replicas is a completed mutation and an incomplete deletion.

### What you store

One immutable row per deletion request, written to a table that ingest cannot touch:

| Field | Value |
|---|---|
| \`request_id\` | the customer's request reference |
| \`tenant_id\` | 84 |
| \`requested_at\` / \`completed_at\` | bounds the SLA claim |
| \`mechanism\` | \`drop_partition\` or \`mutation\` |
| \`mutation_ids\` | from \`system.mutations\`, for the shared path |
| \`verification\` | JSON: tier → host → remaining_rows |
| \`backup_policy_at_time\` | e.g. \`daily, 30-day retention\` |
| \`backups_expire_at\` | \`completed_at + 30 days\` |

### What you can honestly tell a customer

> Your data was removed from all live and replicated storage tiers on 2026-09-18 at 14:07 UTC, verified by a per-tier row count returning zero on every replica. Encrypted backups taken before that date expire on 2026-10-18, after which no copy remains. We can provide the verification record on request.

That is defensible because every clause maps to something you stored.

**What you must not say** is "deleted immediately" or "fully erased" while backups exist. The backup window is the part customers accept when stated plainly and litigate when discovered later. State it in the DPA, not in an incident postmortem.

The uncomfortable follow-on: this only works if backup expiry is automatic and audited. A manual retention policy makes every one of these letters an unverified claim.`,
  },
  {
    id: 'demo-08',
    parentId: 'demo-07a',
    model: 'deepseek/deepseek-r1',
    prompt:
      "Both reviews land on the same hole: the whale isn't static. Give me the procedure for moving a tenant between the shared and dedicated schemes with no write outage and no double-count.",
    response: `The procedure below moves tenant *T* from \`events_shared\` to \`events_whale\`. Reverse the direction for demotion; nothing else changes.

**Invariant to preserve:** at every instant, each event for *T* is durably stored in exactly one of the two tables, and the rollups derive from exactly one.

### 1. Freeze a cutover boundary, don't freeze writes

Pick \`T_cut\` a few minutes in the future, on a minute boundary, and publish it to the routing table:

\`\`\`sql
INSERT INTO tenant_routing VALUES (84, 'whale', '2026-09-18 15:00:00');
\`\`\`

Ingest reads \`(shard, effective_from)\` and routes by event timestamp, not wall clock: \`ts < effective_from\` → shared, \`ts >= effective_from\` → whale. Late-arriving events land in the correct tier on their own, which is what removes the need for dual-write. Writers pick up the new row within their cache TTL — keep it under 30 s and stage the change at least 2 TTLs ahead of \`T_cut\`.

### 2. Backfill history by whole partitions

\`\`\`sql
ALTER TABLE events_whale
  ATTACH PARTITION ID '202609' FROM events_shared_84_extract;
\`\`\`

Extract *T*'s rows per source partition into a staging table with the whale table's exact schema, then \`ATTACH\`. Partition-level attach is a metadata operation — no rewrite, no read amplification on the live tier. Do oldest partitions first; the newest one is the only one still receiving writes below \`T_cut\`.

### 3. Verify before removing anything

Per source partition, compare counts bucketed by minute:

\`\`\`sql
SELECT toStartOfMinute(ts) AS b, count() FROM events_shared
WHERE tenant_id = 84 AND toYYYYMM(ts) = 202609 GROUP BY b
EXCEPT
SELECT toStartOfMinute(ts) AS b, count() FROM events_whale
WHERE tenant_id = 84 AND toYYYYMM(ts) = 202609 GROUP BY b;
\`\`\`

Empty result, both directions, or you stop. A per-minute comparison catches partial attaches that a total count hides.

### 4. Rebuild rollups for the moved range, then swap reads

Materialized views do not fire on \`ATTACH\`, so the whale's rollup tiers must be populated explicitly with \`INSERT INTO m_1m SELECT … FROM events_whale WHERE tenant_id = 84 AND …\`, one partition at a time. Until this completes, queries for *T* must still read the shared rollups — which is why the read path consults \`tenant_routing\` with the same \`effective_from\` logic as ingest.

### 5. Only now delete the source rows

\`ALTER TABLE events_shared DELETE WHERE tenant_id = 84 AND ts < T_cut\`, after verification passed and rollups are rebuilt. Deleting earlier is how you get a gap; deleting later is merely slow.

### Why there is no double-count

Reads never union the two tables for the same time range. \`effective_from\` partitions the timeline, and every read resolves the routing table first. A query spanning \`T_cut\` issues two range-restricted reads whose ranges do not overlap. The failure mode this design still has is a *stale routing cache on a reader* — which shows as a brief gap rather than a duplicate, and is the correct way round for metrics.

### Rollback

Before step 5, rollback is deleting *T*'s rows from the whale table and reverting the routing row. After step 5 it is the same procedure in reverse. Hold the source partitions for 48 hours after cutover before allowing the delete — the verification query is cheap, and a reversible mistake is worth two days of duplicated disk.`,
  },
  {
    id: 'demo-07c',
    parentId: 'demo-06',
    model: TRUNK,
    persona: persona('Performance Engineer'),
    prompt:
      'Review that DDL as written. What will hurt in production, and when does it show up?',
    response: `Four things in the schema are costing you measurable throughput or latency.

**1. \`endpoint String\` in the sort key is your hot-path expense.** It's the one high-cardinality, variable-length column, and it sits third in \`ORDER BY\` — so every granule's index entry carries a string comparison. Two consequences: the primary index is larger than it needs to be (more of it competing for page cache), and merges spend real CPU on string compares. If endpoints are templated, the distinct set per tenant is in the hundreds — make it \`LowCardinality(String)\`. Measured effect on comparable schemas: 20–40% off merge CPU and a visibly smaller mark cache.

**2. \`quantilesTDigestState\` is ~1–3 KB per row, and you have 4B of them.** This is the number that quietly breaks the 180 GB estimate. A t-digest with default compression holds a few hundred centroids; the aggregate state does not compress like a \`UInt64\` does. Either drop compression to ~50 centroids (\`quantilesTDigestWeighted\`-style tuning) or accept that \`m_1m\` is the biggest table you own. Test it before believing either estimate: \`SELECT formatReadableSize(sum(byte_size)) … FROM system.parts\` after a day of real data.

**3. Four materialized views off one insert means four writes per batch, synchronously.** MVs fire inside the insert transaction — your 40k rows/sec ingest is really 40k rows/sec plus four aggregating writes plus their merges. This is the throughput ceiling you'll hit first, and it arrives as insert latency creep, not an error. Chain the views instead of fanning them all off raw: raw → 1m → 5m → 1h, each reading the tier above with \`quantilesTDigestMergeState\`. One write per tier per batch, and the 1h tier processes 1/60th the rows.

**4. \`DateTime64(3)\` on the raw table buys precision you don't query.** 8 bytes per row against \`DateTime\`'s 4, on 3.46B rows/day — ~14 GB/day of index and column data for millisecond resolution that no dashboard reads. Keep \`DateTime64\` only if the 24-hour forensics case genuinely needs sub-second ordering.

**When it shows up:** #3 at your first sustained peak, and it will look like a Kafka consumer lag problem rather than a ClickHouse one. #2 at day 7, when \`m_1m\` reaches steady state and is 5× the projection. #1 and #4 never announce themselves — they're just a permanently higher bill.

The hot path, stated plainly: one insert batch → four aggregating writes → N merges. Everything above is about reducing that fan-out. Nothing about your query shapes worries me by comparison.`,
  },
  {
    id: 'demo-02b',
    parentId: 'demo-02',
    model: TRUNK,
    prompt:
      "Coming back to something from turn 2 now that I've seen the whole design. Make the buy case honestly: what would Datadog or Grafana Cloud cost us at this volume, and what do we give up by building?",
    response: `Worth doing properly, because the build decision should survive the comparison rather than avoid it.

### The vendor arithmetic

Your cost driver is custom metrics, and that is exactly where usage-based pricing is least forgiving. At ~400k active series:

| Option | Rough basis | Monthly |
|---|---|---|
| Datadog (custom metrics) | 400k series, 13-month retention on top | **well past $40k** |
| Grafana Cloud (metrics) | ~400k series at published per-series rates | **$6k–12k**, before 13-month retention |
| Self-hosted, this design | 3 nodes + ~200 GB + your time | **~$1.5–2k** |

Two things to notice. First, Datadog isn't 20% over your $8k ceiling, it's 5× over — at this cardinality it isn't a negotiation, it's a different budget. Second, Grafana Cloud is *within an order of magnitude* of your ceiling, which means it deserves a real evaluation rather than a dismissal.

### What you give up by building

- **Alerting, and it's bigger than it looks.** Rules, routing, escalation, silences, an audit trail. This is easily a quarter of engineering on its own, and you haven't scoped it.
- **Dashboards as a product.** Your tenants will want to build their own. Grafana-as-a-feature is months.
- **Someone else's on-call.** A vendor's 3am merge storm is their problem. Yours will be yours.
- **Ecosystem.** Integrations, agents, client libraries, and the fact that new hires already know the tool.

### What you gain, stated as narrowly as it deserves

- Multi-tenant cost per tenant that doesn't scale with their cardinality — which is the actual reason to build. If you're reselling metrics to 1,200 tenants, a per-series bill is a business-model problem, not an infra one.
- Structural per-tenant deletion, which vendors make you request.
- No cardinality tax, so you can let tenants be careless.

### The honest verdict

Build **if** metrics are a feature of your product that your customers pay for — then the vendor bill grows with your revenue and never stops. Buy **if** metrics are how you observe your own system: at that point the $6–12k of Grafana Cloud is cheaper than the engineer-quarters this design consumes, and every hour spent on t-digest tuning is an hour not spent on the thing customers buy.

Nothing in the previous turns changes if you buy — the cardinality work is required either way, and it's most of what saves you money in both worlds.`,
  },
  {
    id: 'demo-02b2',
    parentId: 'demo-02b',
    model: 'openai/gpt-4.1',
    prompt:
      "We're building — metrics are a billed feature. So: what's the one thing the vendors do that we'll now own and will underestimate?",
    response: `**Alert evaluation.** Not the storage, not the dashboards — the part that runs every rule for every tenant on a schedule and has to be more reliable than the thing it watches.

Why it's underestimated:

1. **It's a second query workload with the opposite shape.** Dashboards are bursty, wide, and human-tolerant of 400 ms. Alert evaluation is continuous, narrow, and thousands of small queries per minute — 1,200 tenants × 20 rules each, every 60 seconds, is 24k queries/minute against the tier you sized for dashboards. Nothing in the plan so far accounts for it.
2. **Correctness under missing data is genuinely hard.** A rule on a series that stopped reporting: firing or not? Both answers are wrong in some case, and every vendor has an explicit, well-documented policy here because they learned it expensively.
3. **State, not just evaluation.** Firing/resolved transitions, deduplication, silences, escalation timing, delivery retries. That state must survive your own outages — which means it cannot live in the metrics store.
4. **It's the feature customers judge you on.** A missed page is a trust event of a different magnitude than a slow dashboard.

### What to do about it now, cheaply

- Size the alert workload explicitly and give it its own pre-aggregated tier. It queries a tiny set of series repeatedly — cache-friendly, but only if you design for it.
- Keep alert state in Postgres, not ClickHouse. You already run it, and this is exactly the transactional workload ClickHouse is bad at.
- Write down the missing-data policy before writing the evaluator, and put it in your docs where customers can read it.
- Ship the narrowest useful version: threshold rules on the 1-minute tier, one delivery channel. Resist rule expressiveness until customers name the rule they can't write.

Second place, for what it's worth, is per-tenant quota and billing metering — also usually a vendor feature, also a continuous query workload, and the one that gets discovered the week before launch.`,
  },
]
