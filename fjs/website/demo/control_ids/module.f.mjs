/**
 * Isolate a demo instance's DOM identifiers without changing its event API.
 * Apply the same pure transformation to prerendered and live views, including
 * manual controls, labels, datalists, accessibility links and SVG paint URLs.
 * @module
 * @import { Element } from '../../../media/html/types.ts'
 */

import { foldElement, mapElement } from '../../../media/html/module.f.mjs'
import { definedEntries } from '../../../types/object/module.f.mjs'

/** @type {string} */
export const scopeMarker = 'data-demo-scope'
/** @type {string} */
export const eventNameMarker = 'data-demo-event-name'

/** @type {readonly string[]} */
const singleReferences = ['list', 'form', 'aria-activedescendant', 'popovertarget', 'commandfor']
/** @type {readonly string[]} */
const listReferences = ['for', 'headers', 'aria-details', 'aria-errormessage', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-flowto', 'itemref']
/** @type {readonly string[]} */
const fragmentReferences = ['href', 'xlink:href']
/** @type {readonly string[]} */
const paintReferences = ['style', 'fill', 'stroke', 'clip-path', 'filter', 'mask', 'marker-start', 'marker-mid', 'marker-end', 'cursor']

const { fromEntries } = Object

/** The IDs a view defines, in document order. @type {(view: Element) => readonly string[]} */
const idsOf = foldElement((/** @type {readonly string[]} */ ids, _, { id }) => id === undefined ? ids : [...ids, id])([])

/** HTML ID-reference lists use ASCII whitespace, not only ordinary spaces.
 * @type {(value: string) => readonly string[]}
 */
const references = value => value.replaceAll('\t', ' ').replaceAll('\n', ' ').replaceAll('\r', ' ').replaceAll('\f', ' ').split(' ').filter(part => part !== '')

/** Stable scopes must differ for repeated instances of one demo module.
 * Colons cannot occur in generated README slugs. The length prefix keeps
 * different scope/ID pairs distinct even when either contains a colon.
 * @type {(scope: string) => (view: Element) => Element}
 */
export const scopeIds = scope => {
    const prefix = `demo-control:${scope.length}:${scope}:`
    /** @type {(id: string) => string} */
    const scoped = id => `${prefix}${id}`
    return view => {
        const ids = idsOf(view)
        /** Leave references outside this view, including README links, alone.
         * @type {(id: string) => string}
         */
        const reference = id => ids.includes(id) ? scoped(id) : id
        /** @type {(value: string) => string} */
        const paint = value => ids.reduce((text, id) => {
            const target = scoped(id)
            return text.replaceAll(`url(#${id})`, `url(#${target})`)
                .replaceAll(`url('#${id}')`, `url('#${target}')`)
                .replaceAll(`url("#${id}")`, `url("#${target}")`)
        }, value)
        /** @type {(entry: readonly [string, string]) => readonly [string, string]} */
        const attribute = ([name, value]) => [name,
            name === 'id' ? scoped(value)
                : singleReferences.includes(name) ? reference(value)
                    : listReferences.includes(name) ? references(value).map(reference).join(' ')
                        : fragmentReferences.includes(name) && value.startsWith('#') ? `#${reference(value.slice(1))}`
                            : paintReferences.includes(name) ? paint(value) : value,
        ]
        return mapElement((tag, attributes) => {
            const { type, name } = attributes
            const radio = tag.toLowerCase() === 'input' && type?.toLowerCase() === 'radio' && name !== undefined
            return [tag, {
                ...fromEntries(definedEntries(attributes).map(attribute)),
                ...(radio ? { name: scoped(name), [eventNameMarker]: name } : {}),
            }]
        })(view)
    }
}
