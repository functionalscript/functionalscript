const i = require('./index')

/** @type {() => never } */
const assert = () => { throw 'assert' }

{
    i.parseModuleUrl('')(
        assert,
        e => {
            if (e.id !== 'expected') assert()
            if (e.params[0] !== ':') assert()
        })
}

{
    i.parseModuleUrl(':')(
        assert,
        e => {
            if (e.id !== 'unknownProtocol') assert()
        })
}

{
    i.parseModuleUrl('github:r')(
        assert,
        e => {
            if (e.id !== 'expected') assert()
        })
}

{
    i.parseModuleUrl('github:functionalscript/node-example')(
        v => {
            if (v.repo.org !== 'functionalscript') assert()
            if (v.repo.name !== 'node-example') assert()
            if ('branch' in v) assert()
        },
        assert)
}

{
    i.parseModuleUrl('github:functionalscript/node-example#main')(
        v => {
            if (v.repo.org !== 'functionalscript') assert()
            if (v.repo.name !== 'node-example') assert()
            if (!('branch' in v)) assert()
            if (v.branch !== 'main') assert()
        },
        assert)
}