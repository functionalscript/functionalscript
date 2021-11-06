const lib = require('./lib')
const i = require('./')

require('./lib/test')

/** @type {() => never} */
const assert = () => lib.panic('assert')

/** @type {(_: boolean) => void} */
const assert_if = c => lib.panic_if('assert_if')(c)

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

{
    const x = Array.from(lib.map(a => a ** 2)([1, 2, 3]))
    lib.panic_if('map')(x.length !== 3)
    lib.panic_if('map[0]')(x[0] !== 1)
    lib.panic_if('map[1]')(x[1] !== 4)
    lib.panic_if('map[2]')(x[2] !== 9)
}

{
    lib.panic_if('join')(lib.join('/')([]) !== '')
    lib.panic_if('join')(lib.join('/')(['a']) !== 'a')
    lib.panic_if('join')(lib.join('/')(['a', 'b']) !== 'a/b')
}