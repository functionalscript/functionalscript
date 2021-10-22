const i = require('./index')

/** @type {() => never } */
const assert = () => { throw 'assert' }

{
    const r = i.parseModuleUrl('')
    if (!('error' in r)) assert()
    if (r.error.id !== 'expected') assert()
    if (r.error.params[0] !== ':') assert()
}

{
    const r = i.parseModuleUrl(':')
    if (!('error' in r)) assert()
    if (r.error.id !== 'unknownProtocol') assert()
}

{
    const r = i.parseModuleUrl('github:r')
    if (!('error' in r)) assert()
    if (r.error.id !== 'expected') assert()
}

{
    const r = i.parseModuleUrl('github:functionalscript/node-example')
    if ('error' in r) assert()
    if (r.value.repo.org !== 'functionalscript') assert()
    if (r.value.repo.name !== 'node-example') assert()
}
