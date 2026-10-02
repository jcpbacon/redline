/**
 * What the Flag list shows, once the Reader has dismissed some Flags
 * (story 23).
 *
 * Pure; no imports, no I/O. Safe in browser and server code.
 *
 *   flagView(rankedFlags) -> {
 *     state:     "clean" | "all-dismissed" | "has-visible",
 *     total:     number of Flags the analysis raised,
 *     visible:   [{ flag, rank }]   not dismissed, in ranked order
 *     dismissed: [{ flag, rank }]   dismissed, in ranked order
 *   }
 *
 * "clean" means the analysis raised no Flags at all. A Document whose Flags
 * were all dismissed by the Reader is "all-dismissed", never "clean": the
 * analysis still found those clauses, and dismissing one is the Reader's
 * decision about it, not a verdict on the Document.
 *
 * `rank` is the Flag's 1-based place in the analysis's ranking and does not
 * change when others are dismissed, so "2nd" names the same clause before and
 * after. A Flag is dismissed when it carries a non-null `dismissedAt`.
 */

/**
 * @template {{ dismissedAt?: string | null }} F
 * @param {readonly F[]} flags already ranked, worst first
 * @returns {{
 *   state: "clean" | "all-dismissed" | "has-visible",
 *   total: number,
 *   visible: Array<{ flag: F, rank: number }>,
 *   dismissed: Array<{ flag: F, rank: number }>,
 * }}
 */
export function flagView(flags) {
  if (!Array.isArray(flags)) throw new TypeError("flagView needs the ranked Flags.");
  /** @type {Array<{ flag: F, rank: number }>} */
  const visible = [];
  /** @type {Array<{ flag: F, rank: number }>} */
  const dismissed = [];
  flags.forEach((flag, i) => {
    (isDismissed(flag) ? dismissed : visible).push({ flag, rank: i + 1 });
  });
  const state = flags.length === 0 ? "clean" : visible.length === 0 ? "all-dismissed" : "has-visible";
  return { state, total: flags.length, visible, dismissed };
}

/** @param {{ dismissedAt?: string | null }} flag */
export function isDismissed(flag) {
  return typeof flag?.dismissedAt === "string" && flag.dismissedAt !== "";
}
