## Green links

**Priority:** P3
**Status:** open

### Problem

The site's links are whatever blue the browser picks, which is the one colour
on the page nobody chose. Everything else is named in `:root` in
`fjs/website/style/module.f.mjs` — a background, a text, a muted text, a
border, a pass and a fail — and a link has no token there at all.

The site is set entirely in a monospace face because nearly every word on it is
an identifier ([`../README.md`](../README.md)). Green is the colour that reads
the same way: a terminal's, which is what this site looks like already.

### Proposal

One token, `--link`, defined in both `:root` blocks and used by the `a` rule
[visited-link-colour](visited-link-colour.md) adds.

**One green cannot serve both schemes.** The terminal green the proposal is
after, `#00ff00`, is 13.65:1 against the dark background `#121212` and 1.37:1
against white — unreadable in the light scheme, where WCAG AA asks 4.5:1 for
text. Every other colour here is already a pair, and so is this one: a dark
green on white, a bright one on `#121212`. Candidates, as contrast against the
scheme each would serve:

| value     | on `#ffffff` | on `#121212` |
| --------- | ------------ | ------------ |
| `#00ff00` | 1.37         | 13.65        |
| `#3fb950` | 2.54         | 7.37         |
| `#81c995` | 1.96         | 9.56         |
| `#137333` | 5.95         | 3.15         |
| `#0f5132` | 9.36         | 2.00         |

**The pair the site already has is `--pass`** — `#137333` light, `#81c995`
dark — and taking it is the decision to make deliberately rather than by
reaching for the nearest green. In the test report green means *passed*: a
failure is red, a passing module's dot and counts are green, and a link in that
same green makes one colour mean both "this went well" and "go here", on the
one page where both appear. So `--link` is its own token even if its first
values are those two, and moving one later does not drag the other with it.

How far the dark scheme goes toward `#00ff00` is the open part. The brighter
the green the more it is the terminal, and the further it sits from the green
the report uses for a verdict; `#3fb950` and `#81c995` are the same choice made
more quietly.

Nothing else about a link changes: the underline stays, hover and focus keep
the browser's behaviour.

### Tasks

- [ ] Choose the pair — one value per scheme, each meeting AA against its own
      background.
- [ ] Add `--link` to both `:root` blocks in
      `fjs/website/style/module.f.mjs` and colour `a` with it.
- [ ] Look at a page in both schemes: the breadcrumb, the lists, and a run's
      report, where green already means something.

### Related

- [visited-link-colour](visited-link-colour.md) — the rule this value goes
  into; one change, not two.
- [favicon](favicon.md) — if the site takes a colour of its own, the mark is
  where it shows first.
- [Generate website](generate-website.md) — the umbrella list.
