## DISOT CLI epic

**Priority:** P3
**Status:** open

### Problem

The Git timestamp and naming proposals define how DISOT evidence and entity
metadata work, but users need an integrated `fjs` workflow to create metadata,
commit staged content with DID signatures and trusted timestamps, and verify
the result.

This epic tracks that workflow in one place. The linked format TODOs remain
the source of truth for wire formats and naming semantics; this file defines
the CLI integration and acceptance criteria.

### Proposal

**Command surface**

Proposed commands (to be finalized with CLI integration):

| Command | Purpose |
| --- | --- |
| `fjs disot init --name <name>` | Create root `.disot.json`. |
| `fjs disot update --name <name>` | Change the existing entity name, preserving other metadata. |
| `fjs disot commit -m <message> [--signer <profile>]... [--tsa <profile>]...` | Commit staged content with DID signatures and trusted timestamps. |
| `fjs disot verify [revision]` | Verify evidence and authorization; default to `HEAD`. |

Example:

```bash
fjs disot init --name '/did:example:alice/coolJsModule'
git add .disot.json src/
fjs disot commit -m "Create entity" --signer personal --tsa primary
fjs disot verify HEAD
```

Profiles select local keys/signing services and TSA endpoints plus accepted
verification policies. Define profile configuration and default selection as
part of implementation. Keep private keys, credentials, and local trust policy
outside tracked entity metadata. Missing required configuration is an error.

**Commit creation**

Create one ordinary Git commit from the captured index tree and parent set,
including initial commits and merges. Preserve staged/unstaged separation.
Freeze tree, parents, author, committer, and message before signing. Use the
companion timestamp specification's exact projections:

1. Construct unsigned base payload A.
2. Add independent `vnd.fjs.didsig` signatures over A to form B.
3. Request independent RFC 3161 timestamps over the same digest of B; verify
   responses and embed their `TimeStampToken` values as repeatable
   `vnd.fjs.ttssig` headers to form C.
4. Optionally add the conventional Git signature last, covering C.
5. Store the final object and update the captured branch ref only if its
   original value is unchanged.

Require at least one DID signer and one accepted TSA for this command, even
though the underlying format permits zero signatures/timestamps. Repeated
`--signer` and `--tsa` select multiple independent providers. Initially require
all selected providers to succeed; do not silently publish a weaker result.

Send a digest and nonce to the TSA. Validate response status, token presence,
digest/algorithm, nonce, signature, certificate authorization and applicable
validity/revocation/trust policy. Store the token, not the response wrapper.
Report timestamp accuracy and conservative upper bounds as specified by the
companion TODO. The embedded timestamp covers B, not the final commit hash or
the later conventional Git signature.

Reject pre-existing signature headers when constructing A; do not silently
strip or transplant evidence from an existing signed commit. Freeze the complete
DID-signature set before requesting timestamps. Define exact byte encoding,
domain separation, header ordering/continuations and unsupported-input handling
in the companion format work before implementing interoperable signing.

A signing, timestamp, validation, or concurrent-ref failure leaves the branch
unchanged and returns a useful nonzero result. Do not implicitly retry against
a different tree or parent set. Define safe retry behavior and cleanup for
temporary state, and refuse unsupported repository states explicitly.
Capture the target ref as well as its old object ID so a concurrent checkout
cannot redirect publication to a different branch.

**Metadata editing**

Create this minimal logical value:

```json
{
  "dialect": "vnd.fjs.disot",
  "name": "/did:example:alice/coolJsModule"
}
```

Use the current naming proposal: one required string-valued `name` and optional
recursive `lock`. Multiple names and `--add-name`/`--remove-name` are deferred
until their authority/resolution semantics are defined.

Resolve the repository root. `init` refuses an existing recognized root
metadata file; `update` requires valid existing JSON metadata with the supported
dialect. Preserve unrelated fields and existing locks, validate the full result,
and write atomically. Refuse conflicting recognized root encodings, including
`.disot.data.js`; this epic's initial editor targets JSON and does not silently
convert DataJS. Nested metadata basenames remain ordinary content.

Both commands edit only the working-tree metadata; staging and committing are
explicit. Prefer absolute DID-qualified names. Relative self-names such as
`./name` require one unambiguous authenticated author DID when established and
are discouraged for shared/transferable entities. Later signers must not
reinterpret an established relative name.

A rename has independent old-name relinquishment and new-name establishment
authorization. Make namespace changes and their effect on unlocked relative
references reviewable; define explicit lock review/update behavior without
silently changing pinned bindings. Merely writing metadata grants no authority.

**Verification and trust**

Report key-signature validity, historical DID-to-key authorization, each TSA's
validity/trust/time bound, conventional Git signature validity when present,
and authorization for the entity operation separately. A missing historical
DID authorization proof must not be reported as verified historical identity.

Consume the naming specification's representation-independent evidence model;
embedded headers do not replace detached attestations. Required authority and
timestamp evidence must both be accepted before reporting an authoritative
shared revision. Expose provisional, untrusted, unsupported, or ambiguous
results explicitly and define exit-code behavior.

An authorized and sufficiently timestamped removal of root metadata relinquishes
only inherited heads in its ancestry. It does not archive incomparable forks.
Git ref names affect retention only, never identity or semantic head selection.
Timestamped merges can anchor parent histories but do not retroactively sign
unsigned ancestors.

### Tasks

- [ ] Finalize command options, profile configuration, defaults, help and exit
      codes using the existing CLI/effect abstractions.
- [ ] Complete/reuse the companion format's byte projections, DID envelopes,
      historical authorization and RFC 3161 token handling.
- [ ] Implement JSON init/update with validation, field preservation, atomic
      writes, single-name semantics and explicit staging.
- [ ] Implement staged commit creation, multiple signers/TSAs, optional final
      Git signature and atomic publication to the captured ref.
- [ ] Implement verification integrating accepted evidence, timestamp accuracy,
      operation authorization and explicit provisional/ambiguous outcomes.
- [ ] Keep pure workflow/format logic in `.f.mjs`; isolate filesystem, signing,
      network and Git interactions behind thin effect adapters.
- [ ] Add deterministic proofs/fixtures for altered payloads, malformed headers,
      key rotation, TSA failure/mismatch/nonce/accuracy, multiple providers,
      concurrent ref changes, initial and merge commits, and failure atomicity.
- [ ] Cover metadata creation/update errors, retained locks/unknown fields,
      conflicting encodings, relative authorship, renames and causal archival.
- [ ] Run companion Git compatibility cases, including stock
      `git verify-commit`, SHA-1/SHA-256 repositories, transport and retention.
      Keep live TSA checks optional; routine proofs use controlled fixtures.
- [ ] Document setup, full create/update/commit/verify examples, trust semantics,
      failure/retry behavior and supported Git operations.

### Related

- [Git trusted timestamp signatures](../../todo/git-trusted-timestamp-signatures.md)
  — canonical signing order, projections, DID identity and RFC 3161 semantics.
- [Git name resolution](../../todo/git-name-resolution.md)
  — metadata schema, single-name scope, authorization, locks and archival.
- [CLI dispatch](../cli/module.f.mjs) — command integration.
- [Effects](../effects/README.md) — pure workflows and host adapters.
