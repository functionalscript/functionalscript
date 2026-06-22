# Lock Free Algorithm

```ts
const upload = (payload: EffectList<IoResult<Vec>>) => {
    const suffix = random(256)

    const newPath = () => {
        const prefix = now() + delta
        const fileName = `${prefix}-${suffix}`
        return `.cas/_stage/${fileName}`
    }

    if (isError(createDir(`.cas/_stage`))) { return error() }
    if (isError(createFile(path))) { return error() }

    let offset = 0
    let hashCompute = createHashCompute()
    for (const ri of payload) {
        if (isError(i)) {
            delete_(path)
            return error()
        }
        const chunk = ri[1]

        r = writeFileBytes(path, offset, chunk)
        if (isError(r)) {
            delete_(path)
            return error()
        }

        // rename the file to lease time
        const nPath = newPath()
        r = rename(path, nPath)
        if (isError(r)) {
            delete_(path)
            return error()
        }
        path = nPath

        hashCompute.update(chunk)
        offset += chunk.length
    }

    const hash = hashCompute.end()
    const [hashPrefix, hashFileName] = splitHashPath(hash)
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
