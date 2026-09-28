## Design Principles of FunctionalScript

In versions 0.*, FunctionalScript (FJS) is shaped as a strict subset of ECMAScript (JS).
FJS prefers simplicity and safety to ease-of-use and extensibility.
That leads to a conclusion that many features of JS are not supported in FJS.

FJS is defined via a semi-formal spec plus a reference implementation.
In case of contradiction, the current "truth" of the spec is the behavior of the reference
implementation (which might have errors, temporarily).

This document discusses the properties of the "ideal" state of the current spec
("ideal" implies that spec errors - if any - are temporary, soon-to-be-fixed artifacts).
FJS's reference implementation accepts FJS-correct subset of JS as a source code, rejecting

1. incorrect JS and
2. correct JS that is not correct FJS.

Besides FJS-correct code that is officially recommended by the semi-formal FJS spec,
FJS code that is "bizarre" (and thus not recommended) can be loaded and executed
by reference FJS implementation.
To officially discourage such code fragments, we plan to implement an official FJS linter
(akin to Rust's clippy) accompanied with documentation on FJS's official guidelines.

In its core, FJS 0.* is purely functional language that preserves only certain OOP-oriented
elements of JS,
while faithfully implementing JS features that don't contradict FJS's design principles
(discussed in this document).
In particular, JS's `this` is not supported as a feature undermining FJS's prioritization
of simplicity and safety.

Here is one example.
On one hand, JS's object prototype chain is consciously removed from FJS's spec
(in accordance with prioritization of simplicity and safety).
On the other hand, FJS supports many of JS's built-in functions,
including `Object.prototype.toString`, allowing dot notation calls (e.g. `o.toString()`),
even though there are no prototype chains behind FJS's hoods.
In addition to that built-in function JS allows implementing a custom version of `toString` at users'
objects. Such custom implementation gets called instead of `Object.prototype.toString`
when that object gets cast implicitly to a string (and sometimes when it gets cast or to a number).
Naturally, users' implementations of custom `toString` uses fields of an object instance
(referred via `this`).
FJS supports custom implementations of toString too, but, since FJS does not
support `this`, such implementation is a static function that cannot read object's fields.
Thus it is much less useful than the JS's option, and is FJS's official guidelines discourage
custom implementations of `toString` (and other similar functions, e.g. `valueOf`).
