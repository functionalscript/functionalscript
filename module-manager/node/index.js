const m = require('..')

/** @type {(_: m.ReadFile) => m.Location} */
module.exports = readFile => {
    /** @type {(_: string[]) => (_: string) => m.Package|m.Packages|undefined} */
    const packages = path => name => {
        const newPath = [...path, name]
        // we only need to check if 'package.json' exist
        return (readFile([...newPath, 'package.json']) === undefined ? packages : pack)(newPath)
    }
    /** @type {(_: string[]) => m.Package} */
    const pack = path => ({
        id: path,
        packages: packages(['node_modules']),
        file: filePath => readFile([...path, ...filePath])
    })
    return { pack: pack([]), local: [] }
}
