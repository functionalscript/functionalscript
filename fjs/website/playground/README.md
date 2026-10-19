# Playground

Games played with FunctionalScript's modules, each in a subdirectory of its
own, each a demo: open one, and its page is the game.

A game is written the way every demo is
([a demo shows what a module does](../README.md#a-demo-shows-what-a-module-does)):
its rules are pure FunctionalScript with proofs, and the page only draws the
state and hands back what the player clicks. So a game's rules are tested
like any other module, and a game runs wherever the site does.

The site lists every subdirectory here on this directory's page, with a play
mark on each game, so adding a game is adding a directory.

## Games

- [`btree`](./btree/module.f.mjs) — the B-tree compaction game: make a
  random B-tree perfect, every node full, by removing keys and inserting
  them again, in as few moves as its par.
