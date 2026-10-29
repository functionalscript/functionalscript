import { option, selectField, button } from './module.f.js'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assertEq } from '../../../asserts/module.f.js'

export const proof = {
    option: () => {
        assertEq(htmlToString(option('a"&', '<Choice>', true)),
            '<!DOCTYPE html><option value="a&quot;&amp;" selected="">&lt;Choice&gt;</option>')
        assertEq(htmlToString(option('', 'Empty', false)),
            '<!DOCTYPE html><option value="">Empty</option>')
    },
    selectField: () => {
        assertEq(htmlToString(selectField({ name: 'pick', label: 'Choose <one>' }, [
            option('a', 'A', false),
            ['optgroup', { label: 'More' }, option('b', 'B', true)],
        ])), '<!DOCTYPE html><p><label for="pick">Choose &lt;one&gt; </label><select id="pick" name="pick"><option value="a">A</option><optgroup label="More"><option value="b" selected="">B</option></optgroup></select></p>')
        assertEq(htmlToString(selectField({ name: 'empty', label: 'Empty' }, [])),
            '<!DOCTYPE html><p><label for="empty">Empty </label><select id="empty" name="empty"></select></p>')
    },
    button: () => {
        assertEq(htmlToString(button('run', 'Run <again>')),
            '<!DOCTYPE html><button type="button" name="run">Run &lt;again&gt;</button>')
        assertEq(htmlToString(button('run', 'Run', false)),
            '<!DOCTYPE html><button type="button" name="run">Run</button>')
        assertEq(htmlToString(button('run', 'Run', true)),
            '<!DOCTYPE html><button type="button" name="run" disabled="">Run</button>')
    },
}
