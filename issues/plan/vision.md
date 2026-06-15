# Vision

## Why content-addressable programming languages are the future

In conventional programming languages, identity is based on origin: when something was created, where it came from, which package version it belongs to. In a content-addressable (CA) programming language, identity is based on **shape**: two values, types, or functions with the same normalized structure are the same thing, regardless of origin.

This resolves several deep problems in modern software:

**Deduplication across packages.** Non-CA languages accumulate many copies of the same library code when different packages depend on overlapping versions. A CA language deduplicates automatically — the same normalized shape has one hash, one stored copy, regardless of how many packages reference it.

**Diamond dependency problem.** When two packages depend on different versions of the same library, the types from each version are treated as incompatible — even if their shapes are identical. A CA language normalizes types by content, so structurally identical types from different versions are the same type. Dependency hell disappears when identity is based on shape, not version label.

**Serialization of everything.** Non-CA languages typically cannot serialize types, classes, or functions. Adapters exist but produce fragile results: deserializing a class may produce a type incompatible with the original (broken `instanceof`, mismatched method tables, etc.). In a CA language, any value — including types and functions — is serializable, because every value is already a content-addressed block. Deserializing a function produces exactly the same hash as the original; deduplication is automatic.

**Checkpoint and restore.** Because the entire runtime state is serializable, a CA program can snapshot itself at any point and resume from that exact state — including the state of all closures, types, and references. This is practically impossible in conventional languages without heroic engineering effort.

**Normalization removes superficial differences.** The CA compiler normalizes code before hashing: it strips comments, whitespace, and renames internal variables to canonical forms. Two versions of a package that differ only in comments produce the same hash — they are the same package. This extends to dead code elimination: unused code that differs between versions does not affect the hash of the parts that are actually used.

FunctionalScript's purely functional, side-effect-free design makes it an ideal foundation for a CA language: without mutation or identity-based equality, normalization is well-defined and deduplication is always safe.

**Copy-paste is safe and deduplicating.** In conventional languages, copying code creates a new identity — a new type or function that may be structurally identical but is treated as distinct. In a CA language, copying a function or type anywhere produces the same hash, because the hash is of the shape, not the location. This makes AI-generated and copy-pasted code snippets first-class citizens: an AI can emit a function without knowing where it will live, and if it has been defined elsewhere before, it is automatically the same thing.

**Memoization is structural.** Because execution is deterministic and every value is identified by content hash, any computation can be cached by `(function_hash, input_hash) → output_hash`. If the same computation has been run before — by anyone, on any machine — the result can be returned instantly from cache. This applies globally across the network.

**The identity problem in conventional languages.** A concrete example in JavaScript:

```js
const a = []
const b = []
if (a !== b) { throw "a !== b" }  // throws — same shape, different identity
if (a !== a) { throw "a !== a" }  // does not throw
```

Even though `a` and `b` are structurally identical (both empty arrays), `a !== b` because JavaScript compares by object identity, not shape. In a CA language, `a` and `b` would have the same hash and be the same value. This eliminates an entire class of bugs and incompatibilities — including the type incompatibility in diamond dependencies, where two copies of the same type compare as unequal despite being structurally identical.


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
