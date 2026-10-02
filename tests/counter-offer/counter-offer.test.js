import { describe, expect, it } from "vitest";
import { copyText, counterOfferReducer, initialCounterOffer } from "../../app/(app)/read/counter-offer.js";

/*
 * The Counter-offer box's behaviour (stories 26–27), without a DOM. A
 * clipboard is anything with writeText, so these tests hand it an in-memory
 * one and read back what landed on it.
 */

function memoryClipboard() {
  const clip = {
    contents: "",
    async writeText(text) {
      clip.contents = text;
    },
  };
  return clip;
}

const DRAFT = "Could we limit the licence to twelve months on your own channels?";

/** Copy the box's current text the way the component does, and apply the result. */
async function copy(state, clipboard) {
  const outcome = await copyText(state.text, clipboard);
  return counterOfferReducer(state, { type: outcome, text: state.text });
}

describe("the Counter-offer box", () => {
  it("starts with the draft and copies it unchanged", async () => {
    const clipboard = memoryClipboard();
    const state = await copy(initialCounterOffer(DRAFT), clipboard);
    expect(clipboard.contents).toBe(DRAFT);
    expect(state).toEqual({ text: DRAFT, status: "copied" });
  });

  it("copies the edited text, not the draft", async () => {
    const clipboard = memoryClipboard();
    const edited = counterOfferReducer(initialCounterOffer(DRAFT), { type: "edit", text: `${DRAFT} Thanks, Sam` });
    const state = await copy(edited, clipboard);
    expect(clipboard.contents).toBe(`${DRAFT} Thanks, Sam`);
    expect(state.status).toBe("copied");
  });

  it("drops the copied confirmation as soon as the text changes again", async () => {
    const copied = await copy(initialCounterOffer(DRAFT), memoryClipboard());
    const edited = counterOfferReducer(copied, { type: "edit", text: "Something else" });
    expect(edited).toEqual({ text: "Something else", status: "idle" });
  });

  it("ignores a copy result for text the Reader has since changed", () => {
    const edited = counterOfferReducer(initialCounterOffer(DRAFT), { type: "edit", text: "Newer" });
    expect(counterOfferReducer(edited, { type: "copied", text: DRAFT })).toEqual(edited);
  });

  it("settles back to idle after a confirmation", async () => {
    const copied = await copy(initialCounterOffer(DRAFT), memoryClipboard());
    expect(counterOfferReducer(copied, { type: "settle" })).toEqual({ text: DRAFT, status: "idle" });
  });

  it("never changes the draft it started from, so a fresh box shows it again", () => {
    const first = initialCounterOffer(DRAFT);
    counterOfferReducer(first, { type: "edit", text: "edited" });
    expect(first.text).toBe(DRAFT);
    expect(initialCounterOffer(DRAFT)).toEqual({ text: DRAFT, status: "idle" });
  });

  it.each([
    ["no clipboard at all", undefined],
    ["a clipboard without writeText", {}],
    [
      "a clipboard that refuses",
      {
        writeText: async () => {
          throw new Error("NotAllowedError: denied");
        },
      },
    ],
  ])("reports a failed copy, without throwing, when there is %s", async (_case, clipboard) => {
    const state = await copy(initialCounterOffer(DRAFT), clipboard);
    expect(state).toEqual({ text: DRAFT, status: "failed" });
  });
});
