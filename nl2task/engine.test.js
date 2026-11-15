import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const { apiLibrary, runAll, stepLibrary } = createRequire(import.meta.url)("./engine.js");

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
  assert.ok(step, id);
  assert.deepEqual(step.apis, [handler]);
  assert.equal(step.mappingStatus, "unverified");
  assert.deepEqual(step.allowedFlows, ["待确认"]);
  const names = [...block.matchAll(/^ {6}([a-z_]+):/gm)].map((match) => match[1]);
  const action = apiLibrary.find((item) => item.id === handler);
  assert.deepEqual(action.params.map((item) => item.name), names);
  assert.equal(action.kind, "action");
}
assert.equal(apiLibrary.find((item) => item.id === "data_remove").confirmRequired, true);
assert.equal(apiLibrary.filter((item) => item.kind === "resolve").length > 0, true);

const created = runAll("在曲线 IdVg 上新建 Region R1，范围 0 到 1，权重 2");
assert.equal(created.slots.curve, "IdVg");
assert.equal(created.slots.region, "R1");
assert.equal(created.slots.range, "0 到 1");
assert.equal(created.slots.weight, "2");
assert.deepEqual(ids(created.results[0]), ["region_create"]);
assert.equal(param(created.results[0], "region_create", "curve").missing, true);
assert.equal(param(created.results[0], "region_create", "weight").value, "2");
assert.deepEqual(ids(created.results[1]), ["curve_resolve", "region_resolve", "range_resolve", "region_create"]);
assert.equal(param(created.results[1], "curve_resolve", "name").value, '"IdVg"');
assert.equal(param(created.results[1], "region_create", "curve").value, "$1.curve_id");
assert.equal(param(created.results[1], "region_create", "region").value, "$2.region_id");
assert.equal(param(created.results[1], "region_create", "range").value, "$3.range_id");
assert.equal(param(created.results[1], "region_create", "weight").value, "2");
assert.deepEqual(created.results[2].calls, []);
assert.match(created.results[2].stages[0].body, /待确认/);
assert.match(created.results[2].stages[0].body, /unverified/);
assert.match(created.results[2].stages[1].body, /不能进入 executable/);

const weight = runAll("把 Region R1 的权重改成 0.5");
assert.deepEqual(ids(weight.results[0]), ["region_weight_change"]);
assert.equal(param(weight.results[0], "region_weight_change", "weight").value, "0.5");
assert.deepEqual(ids(weight.results[1]), ["curve_resolve", "region_resolve", "region_weight_change"]);
assert.equal(param(weight.results[1], "curve_resolve", "name").missing, true);
assert.equal(param(weight.results[1], "region_resolve", "name").value, '"R1"');

const optimizer = runAll("把优化器换成 L-BFGS，迭代 40 次");
assert.deepEqual(ids(optimizer.results[0]), ["optimizer_change", "optimizer_iteration_set"]);
assert.deepEqual(ids(optimizer.results[1]), [
  "flow_resolve",
  "optimizer_resolve",
  "optimizer_change",
  "optimizer_iteration_set",
]);
assert.equal(param(optimizer.results[1], "optimizer_resolve", "name").value, '"L-BFGS"');
assert.equal(param(optimizer.results[1], "optimizer_iteration_set", "iterations").value, "40");
assert.equal(param(optimizer.results[1], "optimizer_change", "insert_after").value, "<未提供>");
assert.match(optimizer.results[1].stages[3].body, /optimizer_change：在 API 库中/);

const ps = runAll("跑一轮 PS，目标是线性");
assert.equal(ps.slots.objective, "linearity");
assert.deepEqual(ids(ps.results[0]), ["ps_run"]);
assert.deepEqual(ids(ps.results[1]), ["targets_resolve", "flow_resolve", "parameters_resolve", "ps_run"]);
assert.equal(param(ps.results[1], "ps_run", "objective").value, '"linearity"');
assert.equal(param(ps.results[1], "ps_run", "flow").value, "$2.flow_id");
assert.equal(param(ps.results[1], "ps_run", "targets").value, "$1.targets_ids");
assert.equal(param(ps.results[1], "ps_run", "devices").missing, false);

const removed = runAll("删掉器件 D1 在 25 度的异常数据");
assert.deepEqual(ids(removed.results[0]), ["data_remove"]);
assert.equal(removed.results[0].calls[0].confirmRequired, true);
assert.equal(removed.results[0].calls[0].destructive, true);
assert.deepEqual(ids(removed.results[1]), ["points_resolve", "device_resolve", "curves_resolve", "data_remove"]);
assert.equal(param(removed.results[1], "device_resolve", "name").value, '"D1"');
assert.equal(param(removed.results[1], "data_remove", "temperature").value, '"25"');

const boundary = runAll("把参数 Vth 的下界调到 0.2，作用域 Global");
assert.deepEqual(ids(boundary.results[0]), ["param_boundary_set"]);
assert.equal(param(boundary.results[0], "param_boundary_set", "lower").value, "0.2");
assert.equal(param(boundary.results[0], "param_boundary_set", "upper").value, "<未提供>");
assert.deepEqual(ids(boundary.results[1]), ["parameter_resolve", "scope_resolve", "param_boundary_set"]);
assert.equal(param(boundary.results[1], "parameter_resolve", "name").value, '"Vth"');
assert.equal(param(boundary.results[1], "scope_resolve", "name").value, '"global"');

const missingBound = runAll("调整参数 Vth 的边界，作用域 Global");
assert.equal(param(missingBound.results[0], "param_boundary_set", "lower").missing, true);
assert.equal(param(missingBound.results[0], "param_boundary_set", "upper").missing, true);
assert.match(param(missingBound.results[0], "param_boundary_set", "lower").source, /at_least_one/);

const conflict = runAll("在曲线 IdVg 上新建 Region R1，范围 0 到 1，并设置这个 Region 的权重为 2");
assert.deepEqual(ids(conflict.results[0]), ["region_create", "region_weight_change"]);
assert.match(conflict.results[0].stages[3].body, /region\.weight 同时被 region\.create 和 region\.weight_set 写入/);

const unknown = runAll("今天天气怎么样");
for (const result of unknown.results) assert.deepEqual(result.calls, []);
assert.match(unknown.results[2].stages[0].body, /没有命中/);

const blank = runAll("   ");
for (const result of blank.results) assert.deepEqual(result.calls, []);

console.log("engine tests passed");
