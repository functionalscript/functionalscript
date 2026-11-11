# Object.keys through the common runtime

**Priority:** P2
**Status:** wip

### Problem

`Object.keys` is refused even though the common runtime can derive it from
native `Object.entries` and the shared array `map` body. Admit the familiar
static function and implement its semantics once for every executor.

### Language-design approval

`sergey-shandar` explicitly requested implementation of `Object.keys` based on
`.map`, in a new pull request, in
[the working session](https://chatgpt.com/local/6af401d2-2f04-8191-9c7c-c4ddba48e03b).
