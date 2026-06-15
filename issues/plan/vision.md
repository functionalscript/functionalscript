# Vision

## Motivation

Today, human communications, connections, and economies are controlled by a small number of large corporations. These platforms extract value from communities rather than returning it to them — they own the social graph, the communication channels, the marketplaces, and the trust infrastructure that people depend on.

A web of trust built on DISOT changes this at the foundation. Trust, identity, communication, and value flow directly between people and communities — without a platform in the middle taking a cut, shaping what you see, or cutting you off. Local economies can strengthen each other through direct trust relationships rather than routing everything through corporations that capture the surplus.

The goal is not to build another platform. It is to build infrastructure that makes platforms unnecessary as gatekeepers.

Large corporations can still play a significant role — for example, providing better search and indexing over a vast decentralized CAS, or high-performance compute nodes. But they participate in the network rather than hosting it. Vendor lock-in shrinks dramatically: your data, your identity, and your social graph live in DISOT, not on their servers. If a service provider behaves badly, you switch — without losing anything.

## What we are building

A layered, universal **DISOT** (Decentralized Immutable Source of Truth) platform accessible via MCP.

DISOT is a content-addressable store that holds only original, non-recomputable content, keyed by content hash. Synchronization between any two DISOT stores is always conflict-free: same hash = same content, so merging is a pure set union — no reconciliation, no conflict resolution, no ordering required.

This property is the foundation for:
- **Multi-device** — sync any two stores, online or offline, always consistent
- **Multi-user** — multiple agents (human or AI) write independently, merge freely
- **Web of trust** — signatures and timestamps are themselves DISOT blocks, so trust chains are verifiable content, not metadata; each participant assigns relative trust levels to signers in their circle
- **Scalability** — stores can be sharded, replicated, or federated without coordination

## The compute loop

AI writes FunctionalScript code that references existing DISOT blocks by hash as its inputs. Execution is deterministic — same code + same input hashes always produce the same output. The output is cached (cache may itself be CAS-backed) but is not DISOT.

To share a result with others, the author must sign and timestamp it: an unsigned block claiming to represent a computation cannot be trusted by anyone outside the author's own process.

Because the computation is deterministic, any user can independently re-run it and sign the same result block if they agree. A result block that accumulates signatures from many independent, trusted signers becomes progressively more trustworthy — without any central authority. Conversely, if a user re-runs the computation and gets a different result, they can label the original block as suspicious and decrease their trust level for its author. Trust is not just additive — it degrades when claims fail independent verification.

Trust is also multidimensional. You may trust your doctor highly for health advice but not for financial advice.

Two distinct DISOT block types handle this cleanly:

- **Signature block** — simple cryptographic attestation: `{ content_hash, signature, signer_pubkey }`. Says "I authored or attest to this content." No domain information needed.
- **Trust block** — a social assertion signed by its author. Describes a trust relationship to a node (person/AI) or to specific content (an article, a computation result), optionally scoped to a domain. Says "I trust/distrust this entity or this content, in this context."
- **License block** — signed by the content author, references a content hash and declares usage terms (e.g. CC BY, MIT, proprietary). Says "here is how others may use this content." Because it is a signed DISOT block, the license is permanently and verifiably attached to the content it covers.
- **Redirect block** — signed by trusted friends of a key holder, points from an old public key to a new one. Used for key recovery: if a private key is stolen or compromised, the owner asks their trusted contacts to publish redirect blocks pointing to their new key. Observers in the trust network see these redirects from sources they trust and update accordingly. No central revocation authority needed — revocation is social, just like trust itself.

Trust blocks form the social graph of the network. They are themselves content in DISOT — signed, timestamped, and subject to their own trust evaluations. The web of trust emerges from the graph of trust blocks, not from any central authority assigning scores.

## Hybrid intelligence network

Each trusted node in the web of trust is a combination of AI and humans — not purely one or the other. Nodes communicate, verify each other's work, and build trust relationships over time.

Because DISOT is the storage layer, the network can persist:
- Conversations between humans and AI
- Reasoning trajectories (the chain of thought, not just the conclusion)
- Computation results with their full provenance (code hash + input hashes + signatures)

This makes the network itself a form of hybrid intelligence: knowledge and reasoning accumulate in DISOT, are signed by their authors, verified by peers, and become progressively more trusted as signatures accumulate. No single node holds the intelligence — it emerges from the signed, timestamped, conflict-free graph of content stored across all nodes.

The web of trust is not just an access-control mechanism — it is the trust topology of the intelligence itself.

## Long-term societal impact

A sufficiently mature DISOT + web of trust network can effectively replace most modern centralized services:

- **Communications** — messages are signed DISOT blocks; delivery is routing between trusted nodes, not through a central server
- **Spam** — users can opt out of receiving messages from outside their trust circles or from nodes with bad reputation. Spam becomes structurally hard: a spammer must first earn trust to reach you, and sending spam destroys that trust instantly.
- **Email & messaging** — same model: content-addressed, signed, delivered peer-to-peer within trust circles
- **Social networks** — the social graph is the web of trust itself; content is DISOT blocks signed by authors; no platform owns the graph
- **Advertising** — trusted advertisement using relative ratings within trust circles; content surfaces based on vouching from people you trust, not opaque algorithmic targeting by a platform
- **Finance** — a financial system without Proof of Work; trust-based consensus via the web of trust replaces energy-intensive mining; value and credit flow through trust relationships, not a global PoW race. Theft is structurally hard: currency only has meaning between trusted parties, so stolen currency can only be spent with people who trust the thief — and once identified as a thief, those trust relationships are revoked, leaving the stolen currency worthless. The attack surface is limited to the thief's own trust circle, which contains their real identity.

- **Moderation** — the web of trust dissolves the "who should moderate, and by whose rules?" problem. There is no central moderator. Each participant controls what they see by controlling their trust circle. Communities can form their own shared trust standards without imposing them on others. Harmful content doesn't reach you if none of your trusted nodes vouch for it. The moderation question becomes personal and social rather than political and institutional.

The common thread: every centralized service today exists because it solves a trust problem (who do I trust to deliver this message? who do I trust to vouch for this identity?) that a sufficiently rich web of trust solves without a center. DISOT provides the immutable, conflict-free substrate; signatures and timestamps provide the provenance; the web of trust provides the social layer.

This is not a near-term goal — it is the horizon the architecture points toward.
