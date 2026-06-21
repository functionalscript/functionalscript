# Lock Free Algorithm

```ts
const upload = (payload: EffectList<IoResult<Vec>>) => {
    const suffix = random(256)
    const prefix = now() + delta
    const fileName = `${prefix}-${suffix}`
    const path = `.cas/_stage/${fileName}`

    let r

    r = createDir(`.cas/_stage`)
    if (isError(r)) { return r }

    r = createFile(path)
    if (isError(r)) { return r }

    let offset = 0
    let hashCompute = createHashCompute()
    let r
    for (const i in payload) {

        r = writeFileBytes(path, offset, i)
        if (isError(r)) {
            delete_(path)
            return r
        }

        // optional: rename the file to the now() + delta
        hashCompute.update(hashCompute)
        offset += i.length
    }
    const hash = hashCompute.end()
    const [hashPrefix, hashFileName] = hashPath(hash)
    const hashDir = `.cas/${hashPrefix}`
    const hashPath = `${hashDir}/${hashFileName}`

    createDir(hashDir)
    rename(path, hashPath)
    delete_(path)

    const s = stats(hashPath)
    return s !== undefined && s.length === offset ? ok(hash) : error()
}
```
