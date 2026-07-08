/*
 * Accordion Block — Canon EDS
 *
 * Variations (DA authoring — parentheses syntax):
 *   accordion                    Default: all collapsed, single panel open at a time
 *   accordion (open-panel-2)     Pre-open panel #2 on load (1-based)
 *   accordion (open-panel-all)   Pre-open all panels on load
 *   accordion (multi-open)       Multiple panels open simultaneously
 *   accordion (expand-all)       Adds Expand All / Collapse All button (multi-open implied)
 *
 * Combined:  accordion (multi-open, expand-all)
 *
 * Nested accordion: author a fragment path or link in the panel body cell.
 * The block auto-detects it and loads the fragment (which can itself be an accordion block).
 *
 * DA only — UE authoring not in scope for this sprint.
 * Ref: AS-8 / LLSD-Accordion
 */

import { loadFragment } from '../fragment/fragment.js';

// NOTE: In Canon SSB project, import from '../../scripts/aem.js' instead.
async function fetchPlaceholders(prefix = 'default') {
  window.placeholders = window.placeholders || {};
  if (!window.placeholders[prefix]) {
    window.placeholders[prefix] = new Promise((resolve) => {
      fetch(`${prefix === 'default' ? '' : prefix}/placeholders.json`)
        .then((resp) => (resp.ok ? resp.json() : {}))
        .then((json) => {
          const placeholders = {};
          (json.data || [])
            .filter((p) => p.Key)
            .forEach((p) => {
              const key = p.Key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
              placeholders[key] = p.Text;
            });
          window.placeholders[prefix] = placeholders;
          resolve(placeholders);
        })
        .catch(() => {
          window.placeholders[prefix] = {};
          resolve({});
        });
    });
  }
  return window.placeholders[prefix];
}

// Enforce single-panel-at-a-time (default variation).
// Only operates on direct child panels — ignores toggle events that bubble
// up from nested accordion fragments inside a panel body.
function enforceExclusiveOpen(block) {
  const directPanels = [...block.children].filter((el) => el.matches('details.accordion-item'));
  directPanels.forEach((details) => {
    details.addEventListener('toggle', (event) => {
      if (event.target !== details) return; // bubbled from a nested accordion — ignore
      if (details.open) {
        directPanels.forEach((other) => { if (other !== details) other.open = false; });
      }
    });
  });
}

export default async function decorate(block) {
  const isMultiOpen = block.classList.contains('multi-open');
  const isExpandAll = block.classList.contains('expand-all');

  // open-panel-{number} or open-panel-all — e.g. class "open-panel-2" or "open-panel-all"
  const openPanelClass = [...block.classList].find((c) => c.startsWith('open-panel-'));
  const openPanelParam = openPanelClass ? openPanelClass.replace('open-panel-', '') : null;

  // Build <details>/<summary> structure from DA rows
  [...block.children].forEach((row) => {
    const details = document.createElement('details');
    details.className = 'accordion-item';

    const summary = document.createElement('summary');
    summary.className = 'accordion-item-label';

    // col 1 → panel title (trigger)
    const titleCol = row.children?.[0];
    if (titleCol) {
      summary.append(...titleCol.childNodes);
    }

    // col 2 → panel body content
    const bodyCol = row.children?.[1];
    if (bodyCol) {
      bodyCol.className = 'accordion-item-body';
    }

    details.append(summary);
    if (bodyCol) details.append(bodyCol);
    row.replaceWith(details);
  });

  // Load fragments: if a panel body contains only a path or link to a fragment,
  // fetch and inject it so nested blocks (e.g. nested accordion) get decorated.
  await Promise.all(
    [...block.querySelectorAll('.accordion-item-body')].map(async (body) => {
      const link = body.querySelector('a');
      const path = link ? link.getAttribute('href') : body.textContent.trim();
      if (path && path.startsWith('/') && !path.startsWith('//')) {
        const fragment = await loadFragment(path);
        if (fragment) body.replaceChildren(...fragment.childNodes);
      }
    }),
  );

  // Pre-open panels for open-panel-{number} / open-panel-all variation
  if (openPanelParam) {
    const panels = [...block.querySelectorAll('details.accordion-item')];
    if (openPanelParam === 'all') {
      panels.forEach((d) => { d.open = true; });
    } else {
      const idx = parseInt(openPanelParam, 10) - 1; // 1-based (panel 1 = first row)
      if (panels[idx]) panels[idx].open = true;
    }
  }

  // Default variation: single panel open at a time (exclusive).
  // Skip for multi-open and expand-all (both allow multiple panels open).
  // TODO: confirm with PO whether expand-all should also enforce exclusive open.
  if (!isMultiOpen && !isExpandAll && !openPanelParam) {
    enforceExclusiveOpen(block);
  }

  // Expand All / Collapse All button — only for expand-all variation
  if (isExpandAll) {
    const placeholders = await fetchPlaceholders();
    const expandLabel = placeholders.expandAllLabel || 'Expand All';
    const collapseLabel = placeholders.collapseAllLabel || 'Collapse All';

    const btn = document.createElement('button');
    btn.className = 'accordion-expand-btn';
    btn.type = 'button';
    btn.textContent = expandLabel;

    btn.addEventListener('click', () => {
      const allPanels = [...block.querySelectorAll('details.accordion-item')];
      const allOpen = allPanels.every((d) => d.open);
      allPanels.forEach((d) => { d.open = !allOpen; });
      btn.textContent = allOpen ? expandLabel : collapseLabel;
    });

    block.prepend(btn);
  }
}
