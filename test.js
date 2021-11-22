const i = require('./')

require('./sequence/iterable/test')
require('./async/iterable/test')
require('./module-manager/test')

/** @type {() => never} */
const assert = () => { throw 'assert' }

/** @type {(_: boolean) => void} */
const assert_if = c => { if (c) { throw 'assert_if' } }

{
    i.parseModuleUrl('')(
        assert,
        e => assert_if(e.id !== 'expected' || e.params[0] !== ':'))
}

{
    i.parseModuleUrl(':')(
        assert,
        e => assert_if(e.id !== 'unknownProtocol'))
}

{
    i.parseModuleUrl('github:r')(
        assert,
        e => assert_if(e.id !== 'expected'))
}

{
    i.parseModuleUrl('github:functionalscript/node-example')(
        v => assert_if(
            v.repo.org !== 'functionalscript' ||
            v.repo.name !== 'node-example' ||
            'branch' in v),
        assert)
}

{
    i.parseModuleUrl('github:functionalscript/node-example#main')(
        v => assert_if(
            v.repo.org !== 'functionalscript' ||
            v.repo.name !== 'node-example' ||
            !('branch' in v) ||
            v.branch !== 'main'),
        assert)
}

{
    i.parseModuleUrl('github:functionalscript/node-example#4b14a7a2b11cf53f037931eb7bef240f96dcea64')(
        v => assert_if(
            v.repo.org !== 'functionalscript' ||
            v.repo.name !== 'node-example' ||
            !('commit' in v) ||
            v.commit !== '4b14a7a2b11cf53f037931eb7bef240f96dcea64'),
        assert)
}
