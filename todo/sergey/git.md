# Git

## Commit

```
tree <tree-object-hash>\n
parent <parent-commit-hash>\n
parent <another-parent-hash>\n        # only for merges
author <name> <email> <unix-time> <timezone>\n
committer <name> <email> <unix-time> <timezone>\n
gpgsig -----BEGIN SSH SIGNATURE-----\n
 <signature-data>\n
 -----END SSH SIGNATURE-----\n
\n
<commit message>
```

## Signature

1. Form commit payload.
2. Compute a hash of the payload.
3. Create a signature for the hash.
4. Add the signature to the commit.
5. Add the commit to Git.

## Trusted Time-Stamp

In another commit, because we can't sign sequentially.
