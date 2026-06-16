# Vision

## Guiding principles

Three principles run through every design decision in this project:

**Simplicity and explainability** — keep things as simple as possible, and be able to explain them. This applies to code, to architecture, and to AI-produced results. A solution that works but cannot be explained is not truly understood. We hold AI to the same standard: an intelligent system must be able to explain what it is doing and why, in terms simple enough for anyone to follow. Complexity that cannot be explained is a sign that the wrong abstraction was chosen — not that the problem is inherently hard.

**Emergence** — complex behavior should arise from the composition of simple, well-understood parts, not from complex primitives. We prefer a small set of minimal building blocks (content-addressed blocks, signatures, trust relations, pure functions) and let richer capabilities — a web of trust, human-readable namespaces, a global DAG, hybrid intelligence — emerge from how those blocks combine.

**Deduplication** — never introduce a new mechanism if an existing one can do the same job. This is the same idea that makes content-addressable storage work, applied to the design itself: one storage model for everything, one language for programming and types and metaprogramming, one trust mechanism for signatures and reputation. Fewer concepts, reused everywhere, beats many specialized ones.

Deduplication is also why FunctionalScript is a strict subset of JavaScript rather than a new language. The world already has a language that billions of lines of code and millions of engineers know — there is no reason to make people learn a fancy new one. We reuse JavaScript's syntax and semantics and obtain the content-addressable properties by *removing* features (mutation, side effects, identity-based equality), not by inventing new ones.

The same logic applies to data. CAS is fundamentally about data, and the de facto data standard is JSON — which is itself a subset of JavaScript. Because FunctionalScript is built on JavaScript, JSON is its native data format: no separate serialization layer, no schema language to learn, no impedance mismatch between code and data. The data we store in CAS and the language we use to process it are the same notation.

Emergence and deduplication reinforce each other: deduplication keeps the set of primitives small, and emergence is what lets a small set of primitives be enough. Simplicity and explainability is the check on both: if the result can't be explained, the primitives aren't simple enough yet.

## Content-addressable programming languages

A content-addressable variation of FunctionalScript — where identity is based on the
normalized shape of code rather than its origin — is a core long-term goal. It enables
automatic deduplication, structural provenance, royalty distribution, semantic-equivalence
proofs, and VM-level optimization.

This rationale has its own document: **[capl.md](./capl.md)**.

## Strategy

For DISOT to become universal infrastructure, adoption must be frictionless. The core components — the CAS implementation, the MCP server, and the FunctionalScript language — are released under the **MIT license**, free for anyone to use, run, embed, or build on. No subscription, no usage fee, no vendor dependency.

The goal is for any person or organization to be able to run their own node on a personal computer without asking anyone's permission. Open infrastructure becomes a standard by being universally accessible; it becomes trusted by being open to inspection.

## Motivation

Today, human communications, connections, and economies are controlled by a small number of large corporations. These platforms extract value from communities rather than returning it to them — they own the social graph, the communication channels, the marketplaces, and the trust infrastructure that people depend on.

A web of trust built on DISOT changes this at the foundation. Trust, identity, communication, and value flow directly between people and communities — without a platform in the middle taking a cut, shaping what you see, or cutting you off. Local economies can strengthen each other through direct trust relationships rather than routing everything through corporations that capture the surplus.

The goal is not to build another platform. It is to build infrastructure that makes platforms unnecessary as gatekeepers.

Large corporations can still play a significant role — for example, providing better search and indexing over a vast decentralized CAS, or high-performance compute nodes. But they participate in the network rather than hosting it. Vendor lock-in shrinks dramatically: your data, your identity, and your social graph live in DISOT, not on their servers. If a service provider behaves badly, you switch — without losing anything.

## Economic impact

Vendor lock-in is not just a technical inconvenience — it destroys competition and, as a consequence, proper wealth redistribution. When a platform owns your data and your social graph, competitors cannot enter the market on merit alone, and value extracted from communities flows to the platform rather than staying in the community.

A trust-based network restores two forces that healthy economies depend on:

- **Competition** — any application or service can participate in the same DAG. Better service, better interface, better tools earn more trust and more business. No moat built from data ownership, only from quality.
- **Locality** — people naturally prefer to do business with those they trust: local businesses, community members, friends. The web of trust makes this preference actionable at scale. Economic value flows along trust relationships, keeping more of it within communities rather than routing it through distant platforms that extract a toll.

## What we are building

A layered, universal **DISOT** (Decentralized Immutable Source of Truth) platform accessible via MCP.

DISOT is a content-addressable store that holds only original, non-recomputable content, keyed by content hash. The main benefit of CAS is **global addressing based on content**: a content hash is a universal address, the same everywhere and forever, derived from the content itself rather than assigned by any authority, location, or server. Anyone, anywhere, refers to the same content by the same name — no coordination, no registry, no central allocator. Every other property below follows from this.

Because addresses come from content, synchronization between any two DISOT stores is always conflict-free: same hash = same content, so merging is a pure set union — no reconciliation, no conflict resolution, no ordering required.

This property is the foundation for:
- **Multi-device** — sync any two stores, online or offline, always consistent
- **Multi-user** — multiple agents (human or AI) write independently, merge freely
- **Web of trust** — signatures and timestamps are themselves DISOT blocks, so trust chains are verifiable content, not metadata; each participant assigns relative trust levels to signers in their circle
- **Scalability** — stores can be sharded, replicated, or federated without coordination

## Protocol-agnostic synchronization

Synchronizing CAS is protocol agnostic. Synchronization still needs a communication protocol to move data between stores, but it can be *any* communication protocol — the conflict-free property of CAS does not depend on which one is used. Because same hash = same content, merging is always a pure set union: a store only ever needs to receive blobs it didn't already have, and it never has to care about losing anything.

The simplest example: if a CAS is stored as files, synchronization can be nothing more than copying one CAS on top of another *without overwriting existing files*. We call this **synchronization by copying files**. No destruction is possible — files that already exist are never overwritten, and the receiver simply gains the blobs it was missing. The same logic generalizes to any transport: HTTP, peer-to-peer gossip, a USB drive, email attachments. The protocol only determines how blobs travel; the correctness of the merge is guaranteed by content addressing alone.

Synchronization is also trust agnostic at the transport level, but not at the acceptance level. Because content addressing makes the merge safe regardless of where blobs come from, we can pull from an untrusted source without risking corruption of what we already hold. When synchronizing from an untrusted source, we apply a trust filter on acceptance: we only accept blobs signed by trusted DIDs. The source can offer anything, but we keep only the content whose provenance we can verify against our web of trust — everything else is discarded. This separates the two concerns cleanly: the protocol moves blobs, and the trust layer decides which blobs are worth keeping.

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

- **Accountability** — once a signed document is published to DISOT (a law, government order, contract, corporate statement, public promise), it cannot be deleted or altered. The historical record is permanent and verifiable. Governments, corporations, and individuals are held to what they actually said and signed, not to what they later claim they said.
- **Moderation** — the web of trust dissolves the "who should moderate, and by whose rules?" problem. There is no central moderator. Each participant controls what they see by controlling their trust circle. Communities can form their own shared trust standards without imposing them on others. Harmful content doesn't reach you if none of your trusted nodes vouch for it. The moderation question becomes personal and social rather than political and institutional.

The common thread: every centralized service today exists because it solves a trust problem (who do I trust to deliver this message? who do I trust to vouch for this identity?) that a sufficiently rich web of trust solves without a center. DISOT provides the immutable, conflict-free substrate; signatures and timestamps provide the provenance; the web of trust provides the social layer.

This is not a near-term goal — it is the horizon the architecture points toward.

## Interoperability

Because DISOT is built on standard cryptographic primitives (content hashing, public key signatures), it integrates naturally with other decentralized content-addressable and identity systems:

- **NOSTR** — uses the same public/private key model; NOSTR events are signed content that can be stored in DISOT or bridged directly
- **Blockchains** — content-addressed, cryptographically signed; DISOT blocks and blockchain records share the same trust primitives and can cross-reference each other
- **ATProto** (Bluesky) — partially compatible; the main divergence is identity: ATProto anchors identity to domain names, while this network uses relative paths through the web of trust (`~/Alice/...`), avoiding dependence on the DNS infrastructure and domain registrars

The goal is not to replace these systems but to be composable with them — a node in this network can also participate in NOSTR, hold blockchain keys, or bridge ATProto content, with DISOT as the common content-addressable substrate.
