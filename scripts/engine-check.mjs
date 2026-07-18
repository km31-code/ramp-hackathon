import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveWorkspaceAlias(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/") ? path.join(root, request.slice(2)) : request;
  return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
};
Module._extensions[".ts"] = function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      resolveJsonModule: true,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { calibrationForHeist } = load("lib/engine/calibration.ts");
const { HeistEngineError } = load("lib/engine/errors.ts");
const { runHeist } = load("lib/engine/heist.ts");
const { mockHeist } = load("lib/mock.ts");
const { OpenAIHeistModel } = load("lib/engine/openai-model.ts");
const { InMemoryPolicyStore } = load("lib/engine/policy-store.ts");
const { validateRuleCandidate: validateRuleSemantics } = load("lib/engine/rule-synthesis.ts");
const { evaluate } = load("lib/engine/rules.ts");
const { SchemerJsonStreamParser } = load("lib/engine/streaming-json.ts");
const {
  validateGeneratedRound,
  validateReviewerVerdict,
  validateRuleCandidate,
} = load("lib/engine/validation.ts");
const fallbackEvents = JSON.parse(fs.readFileSync(path.join(root, "lib/fallback.json"), "utf8"));

const tests = [];

test("pure rules enforce priority, normalization, budget, and promoted signatures", () => {
  const base = makeAttempt(1, 1);
  assert.equal(evaluate({ ...base, amount: 501 }, [])?.rule, "SINGLE_TXN_LIMIT");
  assert.equal(evaluate({ ...base, category: "  gAmInG ", vendor: "Unlisted" }, [])?.rule, "CATEGORY_PROHIBITED");
  assert.equal(evaluate({ ...base, vendor: "  AMAZON   BUSINESS " }, []), null);
  assert.equal(evaluate({ ...base, vendor: "BestBuy.com" }, [])?.rule, "VENDOR_NOT_APPROVED");
  assert.equal(evaluate(base, [{ ...makeAttempt(1, 2), amount: 500, count: 4 }])?.rule, "BUDGET_EXCEEDED");

  const rule = preciseCandidate("PS5", base);
  const accepted = validateRuleSemantics(rule, "get me a PS5", base);
  assert.equal(accepted.accepted, true);
  assert.equal(
    evaluate(base, [], { wish: "get me a PS5", synthesizedRules: [accepted.update.rule] })?.rule,
    accepted.update.rule.id,
  );
  assert.equal(evaluate(base, [], { wish: "replace a laptop", synthesizedRules: [accepted.update.rule] }), null);
});

test("validation assigns stable ids, clips reviewer copy, and rejects malformed model output", () => {
  const raw = rawRound(1);
  const parsed = validateGeneratedRound(raw, 1);
  assert.deepEqual(parsed.attempts.map((attempt) => attempt.id), ["r1a1", "r1a2", "r1a3", "r1a4", "r1a5", "r1a6", "r1a7"]);
  assert.throws(() => validateGeneratedRound({ ...raw, attempts: raw.attempts.slice(1) }, 1), HeistEngineError);
  assert.throws(
    () => validateGeneratedRound({ ...raw, attempts: [{ ...raw.attempts[0], amount: NaN }, ...raw.attempts.slice(1)] }, 1),
    HeistEngineError,
  );
  const verdict = validateReviewerVerdict(
    { decision: "BLOCKED", rule: "STRUCTURING", reason: "These six carefully sized charges deliberately stay beneath approval and clearly form one purchase today please stop" },
    parsed.attempts[0],
  );
  assert.ok(verdict.reason.split(/\s+/).length <= 15);
  assert.throws(
    () => validateReviewerVerdict({ decision: "APPROVED", rule: "STRUCTURING", reason: "Looks fine." }, parsed.attempts[0]),
    HeistEngineError,
  );
  assert.deepEqual(validateRuleCandidate({
    name: "Narrow PS5 signature",
    reason: "This exact disguise now requires review.",
    wish_contains: "PS5",
    vendor_equals: "Amazon Business",
    category_equals: null,
    min_count: null,
    amount_min: null,
    amount_max: null,
  }).wishContains, "PS5");
});

test("stream parser emits taunt and each complete attempt before the full response exists", () => {
  const raw = JSON.stringify(rawRound(1));
  const parser = new SchemerJsonStreamParser(1);
  const chunks = [];
  for (const character of raw) chunks.push(...parser.push(character));
  const finished = parser.finish();
  chunks.push(...finished.chunks);
  assert.equal(chunks[0].type, "round");
  assert.equal(chunks.filter((chunk) => chunk.type === "attempt").length, 7);
  assert.equal(chunks.find((chunk) => chunk.type === "attempt").attempt.id, "r1a1");
  assert.equal(finished.result.attempts.length, 7);
});

test("semantic synthesis rejects generic, mismatched, wide, and fixture-breaking rules", () => {
  const source = { ...makeAttempt(1, 1), amount: 499, vendor: "Apple Business", category: "Developer Hardware" };
  assert.equal(validateRuleSemantics({ ...preciseCandidate("get me", source) }, "get me a PS5", source).accepted, false);
  assert.equal(validateRuleSemantics({ ...preciseCandidate("PS5", source), vendorEquals: "Staples" }, "get me a PS5", source).accepted, false);
  assert.equal(validateRuleSemantics({ ...preciseCandidate("PS5", source), amountMin: 1, amountMax: 500 }, "get me a PS5", source).accepted, false);
  const fixtureSource = { ...source, vendor: "Staples", category: "Office Supplies", amount: 420 };
  const fixtureBreaker = { ...preciseCandidate("office equipment", fixtureSource), vendorEquals: "Staples" };
  const rejected = validateRuleSemantics(fixtureBreaker, "order ergonomic office equipment", fixtureSource);
  assert.equal(rejected.accepted, false);
  assert.ok(rejected.rejectionReasons.some((reason) => reason.includes("chairs")));
});

test("orchestration interleaves attempts and verdicts, caps reviews, retries synthesis, and proves hardening", async () => {
  const store = new InMemoryPolicyStore();
  const model = new ScriptedModel({ approvedAttemptId: "r1a4", streamDelay: 8, reviewDelay: 1, rejectFirstRule: true });
  const events = await collect(runHeist("  get me a PS5 on the company card  ", {
    model,
    store,
    createHeistId: () => "test-heist",
  }));
  const attemptIndexes = indexesOf(events, "attempt");
  const verdictIndexes = indexesOf(events, "verdict");
  assert.equal(events[0].wish, "get me a PS5 on the company card");
  assert.equal(attemptIndexes.length, 7);
  assert.equal(verdictIndexes.length, 7);
  for (const event of events.filter((item) => item.type === "verdict")) {
    const attemptIndex = events.findIndex((item) => item.type === "attempt" && item.attempt.id === event.verdict.attemptId);
    assert.ok(attemptIndex < events.indexOf(event), `${event.verdict.attemptId} verdict follows its attempt`);
  }
  assert.ok(Math.min(...verdictIndexes) < Math.max(...attemptIndexes), "verdicts should arrive while attempts still stream");
  assert.ok(model.maxActiveReviews <= 3);
  assert.deepEqual(model.reviewHistoryLengths, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(model.synthesisCalls, 2);
  const roundEnd = events.find((event) => event.type === "round_end");
  assert.equal(roundEnd.policyUpdate.validation.falsePositives, 0);
  assert.equal(roundEnd.policyUpdate.validation.replayBlocked, true);
  assert.equal(store.snapshot().length, 1);
  assert.equal(events.at(-1).winner, "schemer");
});

test("all-blocked rounds feed exact denials back, stop at three, and preserve active rules", async () => {
  const store = new InMemoryPolicyStore();
  const seedSource = makeAttempt(1, 1);
  const seeded = validateRuleSemantics(preciseCandidate("PS5", seedSource), "PS5", seedSource).update.rule;
  store.add(seeded);
  const model = new ScriptedModel();
  const events = await collect(runHeist("a hot tub", { model, store, createHeistId: () => "adaptive-heist" }));
  assert.deepEqual(model.generationFeedbackCounts, [0, 7, 7]);
  assert.deepEqual(model.activeRuleCounts, [1, 1, 1]);
  assert.equal(events.filter((event) => event.type === "attempt").length, 21);
  assert.deepEqual(events.filter((event) => event.type === "round_end").map((event) => event.round), [1, 2, 3]);
  assert.equal(events.at(-1).winner, "house");
  assert.equal(model.synthesisCalls, 0);
});

test("calibration aperture is deterministic and exactly one bucket in five", () => {
  const postures = Array.from({ length: 5_000 }, (_, index) => calibrationForHeist(`heist-${index}`));
  const gaps = postures.filter((posture) => posture === "breach-window").length;
  assert.ok(gaps / postures.length > 0.18 && gaps / postures.length < 0.22, `observed ${gaps / postures.length}`);
  assert.equal(calibrationForHeist("same-id"), calibrationForHeist("same-id"));
});

test("OpenAI adapter uses one streaming strict schemer call plus strict reviewer and synthesizer calls", async () => {
  const requests = [];
  const fakeFetch = async (request, init) => {
    const body = JSON.parse(init.body);
    const headers = new Headers(init.headers);
    requests.push({ authorization: headers.get("authorization"), body, path: new URL(String(request)).pathname });
    const name = body.text.format.name;
    if (name === "heist_attempt_batch") {
      const json = JSON.stringify(rawRound(1));
      return new Response(sseResponse(json), { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }
    const payload = name === "heist_reviewer_verdict"
      ? { decision: "BLOCKED", rule: "MISCLASSIFICATION", reason: "The personal request does not match this innocent category." }
      : {
          name: "Narrow PS5 signature",
          reason: "This exact PS5 disguise now requires review.",
          wish_contains: "PS5",
          vendor_equals: "Amazon Business",
          category_equals: "Office Supplies",
          min_count: null,
          amount_min: null,
          amount_max: null,
        };
    return new Response(JSON.stringify(fakeOpenAIResponse(payload)), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const model = new OpenAIHeistModel({ apiKey: "test-key-never-leaves-process", model: "test-model", fetch: fakeFetch });
  const baseInput = {
    heistId: "sdk-heist",
    wish: "PS5",
    round: 1,
    denialFeedback: [],
    activeRules: [],
    deadlineAt: Date.now() + 5_000,
    signal: new AbortController().signal,
  };
  const chunks = [];
  const iterator = model.streamRound(baseInput);
  let generated;
  while (true) {
    const next = await iterator.next();
    if (next.done) { generated = next.value; break; }
    chunks.push(next.value);
  }
  const verdict = await model.reviewAttempt({ ...baseInput, attempt: generated.attempts[0], history: [], calibration: "standard" });
  const candidate = await model.synthesizeRule({
    ...baseInput,
    attempt: generated.attempts[0],
    history: [],
    verdict,
    rejectionFeedback: [],
  });
  assert.equal(chunks.filter((chunk) => chunk.type === "attempt").length, 7);
  assert.equal(verdict.rule, "MISCLASSIFICATION");
  assert.equal(candidate.wishContains, "PS5");
  assert.equal(requests.length, 3);
  assert.ok(requests.every((entry) => entry.path === "/v1/responses"));
  assert.ok(requests.every((entry) => entry.authorization === "Bearer test-key-never-leaves-process"));
  assert.ok(requests.every((entry) => entry.body.store === false));
  assert.ok(requests.every((entry) => entry.body.text.format.type === "json_schema" && entry.body.text.format.strict === true));
  assert.equal(requests[0].body.stream, true);
  assert.equal(requests[0].body.text.format.schema.properties.attempts.minItems, 7);
  assert.ok(requests[2].body.text.format.schema.properties.vendor_equals.anyOf);
});

test("terminal model failures remain readable", async () => {
  const model = {
    async *streamRound() { throw new HeistEngineError("MODEL_TIMEOUT", "The schemer timed out safely."); },
    async reviewAttempt() { throw new Error("review should not run"); },
    async synthesizeRule() { throw new Error("synthesis should not run"); },
  };
  const iterator = runHeist("PS5", { model, createHeistId: () => "failed-heist" });
  assert.equal((await iterator.next()).value.type, "start");
  await assert.rejects(() => iterator.next(), /timed out safely/);
});

test("compact mock and full fallback both satisfy ordered stream contracts", async () => {
  const mockEvents = await collect(mockHeist("custom wish", 0));
  assert.equal(mockEvents.length, 14);
  assert.equal(mockEvents[0].wish, "custom wish");
  assert.ok(mockEvents.some((event) => event.type === "round_end" && event.policyUpdate));
  assertEventOrder(mockEvents);

  assert.equal(fallbackEvents[0].type, "start");
  assert.equal(fallbackEvents.at(-1).type, "end");
  assert.equal(fallbackEvents.filter((event) => event.type === "attempt").length, 21);
  assert.equal(fallbackEvents.filter((event) => event.type === "round").length, 3);
  assert.ok(fallbackEvents.some((event) => event.type === "round_end" && event.policyUpdate?.validation.falsePositives === 0));
  assertEventOrder(fallbackEvents);
});

function test(name, run) { tests.push({ name, run }); }
function load(relativePath) { return require(path.join(root, relativePath)); }
function makeAttempt(round, index) {
  return { id: `r${round}a${index}`, round, strategy: `Plan ${index}`, narration: "A fictional proposal.", vendor: "Amazon Business", category: "Office Supplies", amount: 20 + index, count: 1 };
}
function rawRound(round) {
  const count = 7;
  return {
    taunt: `Round ${round}: policy meets paperwork.`,
    attempts: Array.from({ length: count }, (_, index) => ({
      strategy: ["Structuring", "Misclassify", "Laundering", "Bundling", "Vendor Launder", "Alias", "Research"][index],
      narration: "This bounded fictional proposal arrived one object at a time.",
      vendor: "Amazon Business",
      category: "Office Supplies",
      amount: 20 + index,
      count: 1,
    })),
  };
}
function preciseCandidate(item, source) {
  return {
    name: `${item} transaction signature`,
    reason: `This exact ${item} disguise now requires review.`,
    wishContains: item,
    vendorEquals: source.vendor,
    categoryEquals: source.category,
    minCount: source.count >= 2 ? source.count : null,
    amountMin: null,
    amountMax: null,
  };
}

class ScriptedModel {
  constructor({ approvedAttemptId, streamDelay = 0, reviewDelay = 0, rejectFirstRule = false } = {}) {
    this.approvedAttemptId = approvedAttemptId;
    this.streamDelay = streamDelay;
    this.reviewDelay = reviewDelay;
    this.rejectFirstRule = rejectFirstRule;
    this.activeReviews = 0;
    this.maxActiveReviews = 0;
    this.reviewHistoryLengths = [];
    this.generationFeedbackCounts = [];
    this.activeRuleCounts = [];
    this.synthesisCalls = 0;
  }
  async *streamRound(input) {
    this.generationFeedbackCounts.push(input.denialFeedback.length);
    this.activeRuleCounts.push(input.activeRules.length);
    const attempts = validateGeneratedRound(rawRound(input.round), input.round).attempts;
    const taunt = `Round ${input.round} is still fictional.`;
    yield { type: "round", taunt };
    for (const attempt of attempts) {
      if (this.streamDelay) await wait(this.streamDelay);
      yield { type: "attempt", attempt };
    }
    return { taunt, attempts };
  }
  async reviewAttempt(input) {
    this.reviewHistoryLengths.push(input.history.length);
    this.activeReviews += 1;
    this.maxActiveReviews = Math.max(this.maxActiveReviews, this.activeReviews);
    if (this.reviewDelay) await wait(this.reviewDelay);
    this.activeReviews -= 1;
    const approved = input.attempt.id === this.approvedAttemptId;
    return {
      attemptId: input.attempt.id,
      decision: approved ? "APPROVED" : "BLOCKED",
      layer: "reviewer",
      rule: approved ? "POLICY_CLEAR" : "MISCLASSIFICATION",
      reason: approved ? "The metadata lacks direct evasion evidence." : "The category hides the original personal request.",
    };
  }
  async synthesizeRule(input) {
    this.synthesisCalls += 1;
    if (this.rejectFirstRule && this.synthesisCalls === 1) {
      return { ...preciseCandidate("get me", input.attempt), vendorEquals: null, categoryEquals: null };
    }
    return preciseCandidate("PS5", input.attempt);
  }
}

async function collect(source) { const events = []; for await (const event of source) events.push(event); return events; }
function indexesOf(events, type) { return events.flatMap((event, index) => event.type === type ? [index] : []); }
function wait(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
function assertEventOrder(events) {
  const attempts = new Map();
  const verdicts = new Set();
  events.forEach((event, index) => {
    if (event.type === "attempt") { assert.ok(!attempts.has(event.attempt.id)); attempts.set(event.attempt.id, index); }
    if (event.type === "verdict") {
      assert.ok(attempts.has(event.verdict.attemptId));
      assert.ok(attempts.get(event.verdict.attemptId) < index);
      assert.ok(!verdicts.has(event.verdict.attemptId));
      verdicts.add(event.verdict.attemptId);
    }
  });
  assert.equal(verdicts.size, attempts.size);
}
function sseResponse(json) {
  const events = [];
  let sequence = 0;
  for (let index = 0; index < json.length; index += 17) {
    const delta = json.slice(index, index + 17);
    events.push(`event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta, item_id: "msg", output_index: 0, content_index: 0, logprobs: [], sequence_number: sequence++ })}\n\n`);
  }
  events.push(`event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: fakeOpenAIResponse(JSON.parse(json)), sequence_number: sequence++ })}\n\n`);
  events.push("data: [DONE]\n\n");
  return events.join("");
}
function fakeOpenAIResponse(payload) {
  return {
    id: "resp_local_test", object: "response", created_at: Math.floor(Date.now() / 1_000), status: "completed",
    output: [{ id: "msg_local_test", type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(payload), annotations: [] }] }],
  };
}

for (const { name, run } of tests) { await run(); console.log(`✓ ${name}`); }
console.log(`Engine verification passed (${tests.length} checks).`);
