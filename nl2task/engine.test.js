import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const { apiLibrary, buildRequests, parseModelJson, realize, stepLibrary } = createRequire(import.meta.url)("./engine.js");

function ids(result) {
  return result.calls.map((call) => call.api);
}

function param(result, apiId, name) {
  return result.calls.find((call) => call.api === apiId).params.find((item) => item.name === name);
}

const yaml = readFileSync(new URL("./steps.yaml", import.meta.url), "utf8");
const blocks = yaml.split(/\n {2}- id: /).slice(1);
assert.equal(blocks.length, stepLibrary.length);
for (const block of blocks) {
  const id = block.slice(0, block.indexOf("\n")).trim();
  const handler = block.match(/action_handler: (\S+)/)[1];
  const step = stepLibrary.find((item) => item.id === id);
  assert.deepEqual(step.apis, [handler]);
  const names = [...block.matchAll(/^ {6}([a-z_]+):/gm)].map((match) => match[1]);
  assert.deepEqual(apiLibrary.find((item) => item.id === handler).params.map((item) => item.name), names);
}
assert.deepEqual(
  apiLibrary.map((item) => item.id).sort(),
  stepLibrary.map((step) => step.apis[0]).sort(),
);

const utterance = "在曲线 IdVg 上新建 Region R1，范围 0 到 1，权重 2";
const requests = buildRequests(utterance);
assert.deepEqual(requests.map((item) => item.id), ["plan", "code", "preset"]);
assert.match(requests[0].user, /region\.create/);
assert.match(requests[0].user, new RegExp(utterance));
assert.match(requests[1].user, /region_create/);
assert.doesNotMatch(requests[1].user, /curve_resolve/);

const fenced = parseModelJson('```json\n{"steps":[]}\n```');
assert.equal(fenced.ok, true);
assert.deepEqual(fenced.value, { steps: [] });

const outcome = realize(utterance, [
  {
    id: "plan",
    text: JSON.stringify({
      steps: [
        { id: "region.create", params: { curve: "IdVg", region: "R1", range: "0 到 1", weight: 2 } },
        { id: "curve_resolve", params: { name: "IdVg" } },
        { id: "region.weight_set", params: { region: "R1", weight: 0.5 } },
      ],
    }),
  },
  {
    id: "code",
    text: JSON.stringify({
      calls: [
        { api: "region_create", params: { curve: "IdVg", region: "R1", range: "0 到 1", weight: 2 } },
        { api: "curve_resolve", params: { name: "IdVg" } },
      ],
    }),
  },
  { id: "preset", text: JSON.stringify({ steps: ["region.create"] }) },
]);

assert.deepEqual(ids(outcome.results[0]), ["region_create", "region_weight_change"]);
assert.match(outcome.results[0].stages[1].body, /库外步骤 curve_resolve/);
assert.equal(param(outcome.results[0], "region_create", "curve").value, '"IdVg"');
assert.equal(param(outcome.results[0], "region_create", "weight").value, "2");
assert.equal(param(outcome.results[0], "region_weight_change", "curve").missing, true);
assert.match(outcome.results[0].stages[3].body, /region\.weight 同时被 region\.create 和 region\.weight_set 写入/);

assert.deepEqual(ids(outcome.results[1]), ["region_create"]);
assert.match(outcome.results[1].stages[1].body, /库外 API curve_resolve/);
assert.match(outcome.results[1].stages[3].body, /region_create：是步骤库中的 action_handler/);

assert.deepEqual(outcome.results[2].calls, []);
assert.match(outcome.results[2].stages[1].body, /unverified/);
assert.match(outcome.results[2].stages[1].body, /待确认/);

const bounds = realize("调整参数边界", [
  { id: "plan", text: JSON.stringify({ steps: [{ id: "param.boundary_set", params: { parameter: "Vth", scope: "global" } }] }) },
  { id: "code", text: '{"calls":[]}' },
  { id: "preset", text: '{"steps":[]}' },
]);
assert.equal(param(bounds.results[0], "param_boundary_set", "lower").missing, true);
assert.match(param(bounds.results[0], "param_boundary_set", "lower").source, /at_least_one/);

const badEnum = realize("调整边界", [
  { id: "plan", text: JSON.stringify({ steps: [{ id: "region.adjust", params: { mode: "move" } }] }) },
  { id: "code", text: '{"calls":[]}' },
  { id: "preset", text: "不是 json" },
]);
assert.equal(param(badEnum.results[0], "region_adjust", "mode").missing, true);
assert.match(param(badEnum.results[0], "region_adjust", "mode").source, /枚举/);
assert.match(badEnum.results[2].stages[1].body, /不是 JSON/);

const failed = realize("今天天气怎么样", [{ id: "plan", error: "未配置模型" }]);
assert.deepEqual(failed.results[0].calls, []);
assert.match(failed.results[0].stages[0].body, /未配置模型/);

console.log("engine tests passed");
