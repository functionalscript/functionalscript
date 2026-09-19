import { resolve, decode } from './module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

export const proof = {
    decode: () => assertEq(decode('./%64ep.f.js'), 'dep.f.js'),
    // Only the specifier is decoded, once; the importer's filesystem root stays put.
    importPath: () => {
        assertEq(resolve('main.f.js')('./%64ep.f.js'), 'dep.f.js')
        assertEq(resolve('C:/repo/main.f.js')('./%64ep.f.js'), 'C:/repo/dep.f.js')
        assertEq(resolve('dir%25/main.f.js')('./dep.f.js'), 'dir%25/dep.f.js')
        assertEq(resolve('main.f.js')('./%255C.f.js'), '%5C.f.js')
        assertEq(resolve('main.f.js')('./%253A.f.js'), '%3A.f.js')
    },
    // URL dot processing sees encoded components, not decoded filesystem paths.
    // These invalid components vanish before validation; the same components
    // still fail when they survive, or when `..` cancels only an empty one.
    importPathDotSegments: () => {
        for (const component of ['bad%', '%ff', '%2F', '%2f', '%00', '%5C', '%5c', 'C%3A', '%ED%A0%80']) {
            for (const parent of ['..', '.%2e', '%2E.', '%2e%2E']) {
                const specifier = `./${component}/%2E/${parent}/%64ep.f.js`
                assertEq(resolve('main.f.js')(specifier), 'dep.f.js', specifier)
            }
            assertEq(resolve('main.f.js')(`./${component}//../dep.f.js`), null, component)
            assertEq(resolve('main.f.js')(`./${component}/../${component}/dep.f.js`), null, component)
        }
        assertEq(resolve('main.f.js')('./bad%/x/../../dep.f.js'), 'dep.f.js')
        assertEq(resolve('/a/main.f.js')('/bad%/../../dep.f.js'), '/dep.f.js')
        assertEq(resolve('/a/main.f.js')('/../dep.f.js'), '/dep.f.js')
        assertEq(resolve('a/main.f.js')('../../dep.f.js'), '../dep.f.js')
        assertEq(resolve('main.f.js')('./%252e/dep.f.js'), '%2e/dep.f.js')
        assertEq(resolve('main.f.js')('./%252e%252e/dep.f.js'), '%2e%2e/dep.f.js')
        // Do not confuse a raw drive/separator with percent-encoded data.
        assertEq(resolve('main.f.js')('./C:/../dep.f.js'), null)
        assertEq(resolve('main.f.js')('./bad%\\extra/../dep.f.js'), null)
    },
    importPathRefusals: () => {
        for (const specifier of [
            './bad%.f.js', './%ff.f.js', './a%2Fb.f.js', './a%5Cb.f.js', './a%00b.f.js',
            './C%3A/x.f.js', './dir/../c%3a/x.f.js', './%43%3a/x.f.js', './C:relative.f.js',
            './name%3Astream.f.js', './%ED%A0%80.f.js', './%ED%B0%80.f.js',
            './dep.f.js?x=%64', './dep.f.js#x=%64', './dep.f.js?', './dep.f.js#',
            './ignored?x=/../dep.f.js', './ignored#x=/../dep.f.js',
        ]) {
            assertEq(resolve('main.f.js')(specifier), null, specifier)
        }
    },
    // Native URL input is a scalar-value string. Do not apply that replacement
    // to percent-encoded UTF-8: the ED A0 80 case above must still fail.
    importPathSurrogates: () => {
        assertEq(resolve('main.f.js')('./\ud800.f.js'), '\ufffd.f.js')
        assertEq(resolve('main.f.js')('./\udc00.f.js'), '\ufffd.f.js')
        assertEq(resolve('main.f.js')('./\ud800%20.f.js'), '\ufffd .f.js')
        assertEq(resolve('main.f.js')('./%61\udc00.f.js'), 'a\ufffd.f.js')
        assertEq(resolve('main.f.js')('./\ud83d\ude00.f.js'), '\ud83d\ude00.f.js')
    },
}
