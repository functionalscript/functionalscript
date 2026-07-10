# Content-addressable storage

`fs/cas` stores immutable blobs addressed by their content hash. Mutable-object
evolution is represented above the raw CAS layer by revision blobs: the pure
`vnd.fjs.revision` format is defined in [`fs/media/revision`](../media/revision/README.md),
and index/materialization helpers live in `fs/cas/evo`.
