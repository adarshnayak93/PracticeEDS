# Accordion

Collapsible question/answer (or label/content) panels, authored as a table in DA. Supports single- or
multi-panel open state, pre-opening panels on load, an expand/collapse-all control, and nesting one
accordion inside another via fragment references.

## Authoring

In DA, insert an `accordion` block table. Column 1 of each row is the panel title (trigger), column 2 is
the panel body:

| accordion |         |
| --------- | ------- |
| Question 1 | Answer 1 |
| Question 2 | Answer 2 |

### Nesting an accordion inside a panel

To nest an accordion (or any block) inside a panel, put a fragment path in the body cell instead of text:

| accordion |         |
| --------- | ------- |
| Question 3 | /fragments/accordion-nested-demo |

The fragment is loaded and its content is appended into the panel body in place of the path. Only paths
under `/fragments/` are treated as fragment references — plain links and other root-relative paths in the
body are left untouched.

## Variations

Variations are added as block classes, e.g. `accordion (multi-open, expand-all)`.

| Variation | Class | Behavior |
| --- | --- | --- |
| Default | _(none)_ | All panels collapsed on load; opening a panel closes any other open panel (exclusive/single-open). |
| Open panel N | `open-panel-2` | Pre-opens the Nth panel (1-based) on load. Does not enforce exclusive open. |
| Open all panels | `open-panel-all` | Pre-opens every top-level panel on load. Does not enforce exclusive open. |
| Multi-open | `multi-open` | Multiple panels can stay open at once; exclusive-open is not enforced. |
| Expand all | `expand-all` | Adds an Expand All / Collapse All button above the panels (implies multi-open behavior). |
| Dark | `dark` | Not yet implemented — visual spec pending from Design. |

Variations can be combined, e.g. `accordion (multi-open, expand-all)`.

## Nested accordions and variations

`open-panel-*`, `multi-open`/exclusive-open, and the Expand All button all operate on **direct child
panels only** — they never reach into a nested accordion fragment loaded inside a panel body. So
`accordion (open-panel-all)` opens all of the parent's own panels but leaves a nested child accordion in
its own default (collapsed) state, and clicking the parent's Expand All button does not expand/collapse
panels belonging to a nested accordion.

## Accessibility

Built on native `<details>`/`<summary>`, with `aria-expanded` on the trigger kept in sync with the open/
closed state on every toggle.

## Files

- `accordion.js` — builds `<details>`/`<summary>` panels from the DA table, resolves nested fragments,
  applies pre-open/exclusive-open/expand-all behavior per variation.
- `accordion.css` — visual styling, chevron icon, and the `dark` variation styles.
