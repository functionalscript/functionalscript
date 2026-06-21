# CAS Block Scrubbing and Repair

## Purpose

No matter which write strategy a CAS uses, a committed block can later become **invalid** —
its stored bytes no longer match the hash that addresses it. The staging design
([staging-lease.md](staging-lease.md)) works hard to *minimise* the probability of a bad
write, but it cannot drive it to zero, and it only governs the write path up to commit.
Everything after commit needs a separate, always-on backstop: a mechanism — parallel to the
staging GC — that scans committed shards, verifies each against its hash, detects
corruption, and (in the future) repairs it from a friendly peer.

This is the active form of the principle in *staging-lease.md*: hash verification is the
only near-deterministic layer, so the store's integrity guarantee comes from *continuously
re-verifying* the committed bytes, not from trusting that a write once succeeded.

## Why corruption is inevitable

Staging governs the write path up to commit; the committed store is exposed to sources no
staging strategy can touch:

- **Media decay** — bit rot, latent sector errors, degrading flash cells.
- **Hardware/firmware faults** — torn writes, misdirected writes, controller bugs, RAID
  write holes.
- **Durability gaps** — an `fsync` that was acknowledged but not truly persisted, followed
  by power loss.
- **Read-path errors** — memory bit-flips while a shard is read back.
- **Out-of-band mutation** — software or operator accidents that bypass the read-only bit
  (`chmod 444` does not stop a directory-writer from `rename`/`unlink`, as noted in
  strategy-1.md).
- **Write-path residue** — even at commit, the base staging design trusts the incrementally
  accumulated hash and does not re-read, so a torn or misdirected write the OS acknowledged
  but did not persist can commit a shard whose bytes already differ from its hash.

The last point is the important honesty: lock-free staging *reduces* the probability of an
incorrect write, but — exactly as with everything else in this design — it cannot guarantee
one never happens. Scrubbing is the layer that assumes it eventually will.

## Scope: scrubbing is GC's dual

Scrubbing and the staging GC partition the store cleanly and never overlap:

| | Staging GC | Scrub |
|---|---|---|
| Domain | `.cas/_staging/` (in-progress uploads) | `.cas/<prefix>/` (committed shards) |
| Question | "is this upload still alive?" | "do these bytes still match their hash?" |
| Signal | deadline in the file name | re-hash vs. the address |
| Action | `rm` expired/orphaned files | quarantine + repair corrupt shards |
| Failure mode | over-eager delete ⇒ restarted upload | undetected corruption ⇒ bad read |

GC guards the write-in-progress space; scrub guards the committed space. Together they cover
the whole store, with no shard in both domains at once.

## Detection: the address is the checksum

In a content-addressed store the shard's path *is* its expected hash, so detection needs no
side metadata:

```
scrub_block(path):
  expected = hashFromPath(path)            // the address itself
  actual   = hash(readAll(path))           // re-read and re-hash the bytes
  if actual != expected:
      report/quarantine(path)              // the block is corrupt
```

Because the expected value is the name, there is nothing to keep in sync, nothing to
corrupt separately, and no question of which copy is authoritative.

## Repair: re-fetch by hash, verify by hash

Repair is where content addressing pays off most. Mutable-replication systems face version
skew and quorum ambiguity; a CAS does not. The hash is a *global* content address, so **any
source that has that hash has byte-identical content by definition**. Repairing a corrupt
block is therefore unambiguous and cannot go wrong:

```
repair_block(key):
  bytes = fetchFromPeer(key)               // future: ask a friendly CAS for this hash
  if hash(bytes) == key:                   // verify by the same address
      recommit(key, bytes)                 // staging + rename over the corrupt shard
  // else try another peer; a peer that fails verification is simply skipped
```

`recommit` reuses the ordinary staging+rename machinery: write the re-fetched bytes to a
staging file, verify, and atomically rename over the corrupt shard (clearing/replacing the
read-only bit as `commit` already does). A repaired block is verified by the same hash that
named it, so a corrupt block can never be "repaired wrong."

In a single store with no redundancy, detection is all that is possible — the scrubber can
quarantine a corrupt shard but not rebuild it. Repair requires either local redundancy
(out of scope here) or the peer-reupload path above. The peer mechanism is future work; the
detection half stands alone and is useful immediately.

## Two intensities, like GC's lazy/sweep split

- **Verify-on-read.** Re-hash a shard as it is read for normal use and compare to its
  address. This catches corruption at the point of use for nearly free and covers *hot*
  blocks continuously. It can be sampled (verify a fraction of reads) to bound CPU.
- **Background sweep.** A throttled scan of all committed shards, prioritised by
  least-recently-scrubbed. This covers *cold* blocks that nobody reads — precisely where
  bit rot accumulates undetected. Like the staging GC it is not urgent and can run lazily or
  on a schedule; like a ZFS/Ceph scrub it is I/O-heavy and must be rate-limited.

Verify-on-read and the sweep are complementary: the first bounds the damage of corruption in
active data, the second bounds how long corruption can hide in dormant data.

## Relationship to Strategy 3 (Merkle tree)

Scrubbing composes naturally with [strategy-3.md](strategy-3.md): a Merkle tree's internal
nodes are themselves CAS blocks, so scrubbing every leaf and internal node verifies the
whole tree. A corrupt leaf can be repaired from a peer while its parent hashes continue to
validate the rest, so repair is localised to the damaged block rather than the whole file.

## Defense in depth and the probabilistic contract

Scrubbing is one layer in a stack, none of which is 100% and all of which compose:

1. **Probabilistic prevention** — lock-free staging minimises incorrect writes.
2. **Probabilistic detection** — scrubbing (verify-on-read + sweep) bounds how long an
   invalid block survives.
3. **Near-deterministic verification** — the hash check is certain up to the
   astronomically small probability of a collision.
4. **Repair** — re-fetch by hash from a friendly peer, verified by the same hash.

No single layer guarantees integrity, and the design does not pretend otherwise. Composed,
they push the probability of an *undetected and unrepaired* corrupt block down toward the
hash-collision floor — which is the strongest guarantee a content-addressed store can
honestly offer.

## Caveats

- **A full sweep is O(total bytes).** It must be throttled and scheduled; it is not free.
- **Detection without redundancy cannot repair.** Until the peer-reupload mechanism exists,
  a single store can only quarantine and report corrupt shards.
- **Collision-masked corruption is undetectable** — if corrupted bytes happened to hash to
  the same address, the check passes. This is the same ~collision-probability floor the rest
  of the design accepts as "certain enough."
- **Verify-on-read costs CPU per read** and should be sampled rather than applied to every
  read on hot paths.
