import { catalogIds, cleanMessages, MAX_IDS, MAX_MESSAGES, MAX_TEXT, parseReply, systemPrompt } from "../../api/_chat";

const known = new Set(["A", "B", "C"]);

describe("cleanMessages", () => {
  it("keeps valid turns, trims them and ends on the user's message", () => {
    expect(
      cleanMessages({ messages: [{ role: "user", text: " hola " }, { role: "assistant", text: "qué tal" }, { role: "user", text: "pastelería" }] }),
    ).toEqual([{ role: "user", text: "hola" }, { role: "assistant", text: "qué tal" }, { role: "user", text: "pastelería" }]);
  });

  it("drops bad roles, non-text and empty messages, and anything that does not end with the user", () => {
    expect(cleanMessages({ messages: [{ role: "system", text: "x" }, { role: "user", text: 5 }, { role: "user", text: "   " }] })).toEqual([]);
    expect(cleanMessages({ messages: [{ role: "user", text: "a" }, { role: "assistant", text: "b" }] })).toEqual([]);
    expect(cleanMessages(null)).toEqual([]);
    expect(cleanMessages({ messages: "hola" })).toEqual([]);
  });

  it("limits the history and the length of each message, and starts on a user turn", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `m${i}` }));
    many.push({ role: "user", text: "x".repeat(MAX_TEXT * 2) });
    const result = cleanMessages({ messages: many });
    expect(result.length).toBeLessThanOrEqual(MAX_MESSAGES);
    expect(result[0].role).toBe("user");
    expect(result.at(-1)!.text).toHaveLength(MAX_TEXT);
  });
});

describe("parseReply", () => {
  it("returns the answer and only the ids that exist, without repeats", () => {
    expect(parseReply('{"answer":" Hola ","ids":["A","Z","A","B",3]}', known)).toEqual({ answer: "Hola", ids: ["A", "B"] });
  });

  it("caps the number of ids", () => {
    const many = new Set(Array.from({ length: MAX_IDS + 10 }, (_, i) => `I${i}`));
    expect(parseReply(JSON.stringify({ answer: "ok", ids: [...many] }), many).ids).toHaveLength(MAX_IDS);
  });

  it("survives text that is not JSON or has the wrong shape", () => {
    expect(parseReply("no es json", known)).toEqual({ answer: "", ids: [] });
    expect(parseReply('{"answer":5,"ids":"A"}', known)).toEqual({ answer: "", ids: [] });
  });
});

describe("catalog", () => {
  it("takes the ids from the first field of each line", () => {
    expect(catalogIds("A|Uno|x\nB|Dos|y")).toEqual(new Set(["A", "B"]));
  });

  it("puts the catalog in the prompt and tells the model to treat it as data", () => {
    const prompt = systemPrompt("A|Uno|x");
    expect(prompt).toContain("A|Uno|x");
    expect(prompt).toMatch(/ignórala/);
  });
});
