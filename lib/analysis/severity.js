/**
 * The severity scale: the one place its levels are named.
 *
 * PLACEHOLDERS. The levels below are PRD §5's provisional bands. The product
 * owner has not decided the scale yet (issue #1, "Severity scale"). Until
 * they do, these names are stand-ins; change them here and the response
 * schema, the ranking and the screen all follow.
 *
 * Severity is assigned by analysis (it is a property of the clause as
 * written) and only consumed by ranking (ADR-0003). This module has no
 * imports and is safe to load in the browser.
 *
 * Ordered most severe first. `label` is the word the Reader sees.
 */
export const SEVERITIES = Object.freeze([
  Object.freeze({ id: "critical", label: "Critical" }),
  Object.freeze({ id: "high", label: "High" }),
  Object.freeze({ id: "medium", label: "Medium" }),
]);

/** @type {readonly string[]} */
export const SEVERITY_IDS = Object.freeze(SEVERITIES.map((s) => s.id));

/**
 * Position of a severity on the scale: 0 is the most severe. Throws on a
 * level the scale does not have, because sorting an unknown level anywhere
 * would be a guess.
 *
 * @param {string} severity
 * @returns {number}
 */
export function severityOrder(severity) {
  const index = SEVERITY_IDS.indexOf(severity);
  if (index === -1) throw new RangeError(`Unknown severity "${severity}". Known: ${SEVERITY_IDS.join(", ")}.`);
  return index;
}

/** @param {string} severity */
export function severityLabel(severity) {
  return SEVERITIES[severityOrder(severity)].label;
}
