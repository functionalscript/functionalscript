const at
: (a: unknown) => (i: any) =>unknown
= a => i => Object.getOwnPropertyDescriptor(a, i)?.value

const utf8 = (...x: [readonly string[]]) => x

type TemplateType = `<html>${string}</html>`

export default {
    literal: () => {
        const x = utf8`17`
        const m: TemplateType = '<html>Hello</html>'
    },
    ownProperty: {
        null: {
            throw: () => Object.getOwnPropertyDescriptor(null, 0),
        },
        undefined: {
            throw: () => Object.getOwnPropertyDescriptor(undefined, 0),
        },
        bool: () => {
            const v = at(true)('x')
            if (v !== undefined) {
                throw v
            }
        },
        array: () => {
            const a = ['42']
            {
                const v = at(a)('0')
                if (v !== '42') { throw v }
            }
            {
                const v = at(a)(0)
                if (v !== '42') { throw v }
            }
        },
        object: {
            null: () => {
                const o = { null: 'hello' }
                const v = at(o)(null)
                if (v !== 'hello') { throw v }
            },
            undefined: () => {
                const o = { undefined: 'hello' }
                const v = at(o)(undefined)
                if (v !== 'hello') { throw v }
            }
        },
        string: {
            number: () => {
                const o = 'hello'
                const v = at(o)(1)
                if (v !== 'e') { throw v }
            }
        }
    }
}
