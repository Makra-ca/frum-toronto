---
name: single-writer-for-approval-status
description: setApprovalStatus is the only place approval_status is written for the eight submission types
type: decision
date: 2026-07-31
status: accepted
---

**Decision:** One helper owns every approval transition, the broadcast decision
and the submitter notification. Roughly fifteen routes that wrote the column
directly now delegate to it.

**Context:** The logic had already drifted twice in the events edit path — it
set `pending` unconditionally without loading the user row, so a trusted user
correcting their own live event self-unpublished it; and it wrote the status
directly, so an auto-approver's edit could publish without announcing and
without stamping `broadcast_at`.

**Chose over:** naming the risk in the spec and leaving the writes distributed,
which is what the first draft did. Anything left off the helper silently
notifies nobody, or silently re-broadcasts to thousands.

**Consequences:** Edit paths write content first, then hand the transition over,
so anything the announcement quotes carries the corrected text. Because
`neon-http` has no transactions those are two round trips, and a failure
between them leaves an edited item with its old status until the user retries.

Related: [[broadcast-at-is-the-real-guard]]
