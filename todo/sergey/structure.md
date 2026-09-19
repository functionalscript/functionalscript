## DISOT

- Hash

## Git Projection

Files:

- `.disot.json`

```ts
{
    "name": "path"
}
```

Where `path` is either

- `/did:.../name` - global from a user's DID.
- `~/name` - relative from the current user's DID.

Don't use `../` or `./` in the `.disot.json`.

Fully resolved name `TREE-HASH/dir`.

Name discover:

1. Restore the full path. Resolve a current user if needed.
2. Find all paths that matches.

**Note**, digital signature are used to accept or reject documents but not to discover. They may have priorities. For example, Alice can edit Bob's document. Alice can be a friend of Bob and Bob can see the document revision but he may ignore the revisions or accept them by signing them.

## Digital Signature and TTS

These records can be in a special branch.

## Hash Mapping

Map all SHA1 hashes to a stronger hash.

## Multiple Repos

For the name discovery repos (as DNS) play only temporary name where to look and doesn't certify names. Only DID signature certifies.

## Git Branches

Git branches are mutable and only used as temporary aliases and to keep commits from GC. We can have some conventions how to name them but it's not necessary.
