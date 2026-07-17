import { assert, assertEq } from '../../asserts/module.f.ts'
import { unwrap } from '../../types/result/module.f.ts'
import {
    validatePackageJson,
    validatePackageJsonText,
} from './module.f.ts'

export const proof = {
    parseMetadata: () => {
        const result = unwrap(validatePackageJsonText('{"name":"x","version":"1.0.0","scripts":{"test":"node test.js"}}'))
        assertEq(result.name, 'x', result)
        assertEq(result.version, '1.0.0', result)
        assertEq(result.scripts?.test, 'node test.js', result)
    },
    malformedJson: () => {
        const result = validatePackageJsonText('{')
        assert(result[0] === 'error', result)
    },
    validationError: () => {
        // valid JSON but `name` is a number, not a string — validation should fail
        const result = validatePackageJsonText('{"name": 42}')
        assert(result[0] === 'error', result)
    },
    validatePreservesOriginalObject: () => {
        const object = { name: 'x', version: '1.0.0', private: true } as const
        const metadata = unwrap(validatePackageJson(object))
        assertEq(metadata.name, 'x', metadata)
        assertEq(metadata.version, '1.0.0', metadata)
        assert(Object.is(metadata, object), metadata)
        assertEq(object.private, true, object)
    },
}
