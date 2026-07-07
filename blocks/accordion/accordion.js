/*
 * Accordion Block — Canon EDS
 * Variations: default | light | dark | expand-all
 * DA authoring: 2-column table — col 1 = panel title, col 2 = panel body
 */

// NOTE: In the Canon SSB project, import fetchPlaceholders from '../../scripts/aem.js'.
// PracticeEDS does not export it yet, so a local version is used here.
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
              // "expand-all-label" → "expandAllLabel"
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

export default async function decorate(block) {
  const isExpandAll = block.classList.contains('expand-all');

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

  // "Expand All / Collapse All" button — only for expand-all variation
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
