/*
 * The Counter-offer's behaviour, kept apart from React so it can be tested
 * without a DOM (stories 26–27; spec, "Client-only behaviour").
 *
 * State is { text, status }: `text` is what the Reader sees in the box, which
 * starts as the model's draft and changes as they edit; `status` is the
 * outcome of the last copy, "idle" | "copied" | "failed". Nothing here is
 * saved anywhere. The draft the component was given is never changed, so a
 * fresh mount (a reload) shows it again.
 */

/** @typedef {"idle" | "copied" | "failed"} CopyStatus */
/** @typedef {{ text: string, status: CopyStatus }} CounterOfferState */
/**
 * @typedef {{ type: "edit", text: string }
 *   | { type: "copied", text: string }
 *   | { type: "failed", text: string }
 *   | { type: "settle" }} CounterOfferAction
 */

/** @param {string} draft @returns {CounterOfferState} */
export function initialCounterOffer(draft) {
  return { text: draft, status: "idle" };
}

/**
 * Editing clears any copy confirmation, because the text on the clipboard is
 * no longer the text in the box. A copy result that arrives for text the
 * Reader has since changed is ignored for the same reason.
 *
 * @param {CounterOfferState} state
 * @param {CounterOfferAction} action
 * @returns {CounterOfferState}
 */
export function counterOfferReducer(state, action) {
  switch (action.type) {
    case "edit":
      return { text: action.text, status: "idle" };
    case "copied":
    case "failed":
      return action.text === state.text ? { ...state, status: action.type } : state;
    case "settle":
      return state.status === "idle" ? state : { ...state, status: "idle" };
    default:
      return state;
  }
}

/**
 * Put `text` on the clipboard. `clipboard` is anything with the Clipboard
 * API's writeText; the component passes `navigator.clipboard`, which is
 * missing outside a secure context. Never throws.
 *
 * @param {string} text
 * @param {{ writeText?: (text: string) => Promise<void> } | undefined | null} clipboard
 * @returns {Promise<"copied" | "failed">}
 */
export async function copyText(text, clipboard) {
  if (!clipboard || typeof clipboard.writeText !== "function") return "failed";
  try {
    await clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
