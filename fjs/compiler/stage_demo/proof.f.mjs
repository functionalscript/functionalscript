import { assert, assertEq } from '../../asserts/module.f.js'
import { htmlToString } from '../../media/html/module.f.mjs'
import { occurrences } from '../../types/string/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
import { examples } from '../examples/module.f.js'
import { parsed, stageDemo } from './module.f.mjs'

export const proof = {
    stageDemo: () => {
        const demo = stageDemo({ intro: 'Shows the source.', name: 'stage' })(text => [['p', `seen ${text}`]])
        assertEq(demo.init, examples[0][1])
        const shown = htmlToString(demo.view('export default 1;'))
        assert(shown.includes('<p>Shows the source.</p>'), shown)
        assert(shown.includes('<label for="stage">Source </label>'), shown)
        assert(shown.includes('<textarea id="stage" name="stage" rows="8" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off">export default 1;</textarea>'), shown)
        assertEq(occurrences('<option value=')(shown), examples.length)
        assert(shown.includes('<span data-token="keyword">export</span>'), shown)
        assert(shown.endsWith('<p>seen export default 1;</p></div>'), shown)
        // a program of several files shows its stage of the main module, and says so
        const linked = htmlToString(demo.view('export default 1;\n// @filename: m.f.js\nexport default 2;'))
        assert(linked.endsWith('<p>This stage reads the main module, the text before the first // @filename: line. The compiler page links it with the other files.</p><p>seen export default 1;</p></div>'), linked)
        // a text whose files are refused is read whole, and says nothing of files
        const refused = 'export default 1;\n// @filename: m.js'
        assert(htmlToString(demo.view(refused)).endsWith(`<p>seen ${refused}</p></div>`), refused)
    },
    parsed: () => {
        const imports = parsed(module => ok(module.imports.length))
        assertEq(JSON.stringify(imports('import a from "a";\nexport default a;')), '["ok",1]')
        assertEq(JSON.stringify(imports('export default "\\x41";')), '["error","unexpected token"]')
        const refusing = parsed(() => error('the stage refuses'))
        assertEq(JSON.stringify(refusing('export default 1;')), '["error","the stage refuses"]')
    },
}
