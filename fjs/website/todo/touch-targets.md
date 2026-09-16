## Touch-sized links in a page's lists

**Priority:** P3
**Status:** open

### Problem

A page lists its files, directories and issues as one line of text each, with
the next line directly under it. On a phone that is a target a finger cannot
pick without risking its neighbour: at `d05b70ce`, rendered at 390px, every
listed link was 19px tall, under the 24px minimum of WCAG 2.2's target size.

### Proposal

Pad each listed link to a taller target only where the input is a finger, so a
desktop list stays as dense as it is:

```css
@media (any-pointer: coarse) {
    [data-section] > ul a { display: inline-block; padding-block: .25rem }
}
```

That makes a link 27px tall at 16px. It was prototyped in
[#2063](https://github.com/functionalscript/functionalscript/pull/2063) and
taken out of it as a second feature.

**Which query is the open question.** `pointer: coarse`, as prototyped, tests
only the *primary* pointer: a touch-screen laptop whose primary pointer is a
trackpad keeps the small targets for a finger. `any-pointer: coarse` covers
it, and pads the lists of that laptop for its trackpad too. Padding every list
on every device is the third answer — no query at all, and a longer page on a
desktop.

### Tasks

- [ ] Decide the query, or none.
- [ ] Add the rule to `fjs/website/style/module.f.mjs` with its reason.
- [ ] Measure it in a rendered phone viewport and on a desktop.

### Related

- [`fjs/website`](../README.md) — why lines on this site may break inside a
  word, the layout change this was prototyped alongside.
- [Generate website](generate-website.md) — the umbrella list.
