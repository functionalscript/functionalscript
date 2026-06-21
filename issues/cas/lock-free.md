# Lock Free Algorithm

```ts
const upload = (payload: EffectList<IoResult<Vec>>) => {
    const suffix = random(256)

    const newPath = () => {
        const prefix = now() + delta
        const fileName = `${prefix}-${suffix}`
        const path = `.cas/_stage/${fileName}`
    }

    if (isError(createDir(`.cas/_stage`))) { return error() }
    if (isError(createFile(path))) { return error() }

    let offset = 0
    let hashCompute = createHashCompute()
    for (const i in payload) {

        r = writeFileBytes(path, offset, i)
        if (isError(r)) {
            delete_(path)
            return error()
        }

        const nPath = newPath()
        r = rename(path, nPath)
        if (isError(r)) {
            delete_(path)
            return error()
        }

        path= nPath

        // optional: rename the file to the `now() + delta`
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
    return s !== undefined && s.length === offset
        ? ok(hash)
        : error()
}
```
