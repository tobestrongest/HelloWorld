// 步骤库来自 steps.yaml。API 库只收录这些步骤的 action_handler。
// 选哪些步骤、填哪些参数，由模型决定。程序只负责校验名称并展开成 API 列表。

const stepSpecs = [
  {
    id: "region.create",
    name: "新建 Region",
    params: [
      { name: "curve", type: "curve_ref", required: true },
      { name: "region", type: "region_ref", required: true },
      { name: "range", type: "range_ref", required: true },
      { name: "weight", type: "number", required: true },
    ],
    action_handler: "region_create",
    mapping_status: "unverified",
    writes: [
      { object: "region", field: "existence" },
      { object: "region", field: "range" },
      { object: "region", field: "weight" },
    ],
    allowed_flows: ["待确认"],
    change_class: "structure",
  },
  {
    id: "region.adjust",
    name: "调整已有 Region 边界",
    params: [
      { name: "curve", type: "curve_ref", required: true },
      { name: "region", type: "region_ref", required: true },
      { name: "new_range", type: "range_ref", required: true },
      { name: "mode", type: "enum", values: ["expand", "shrink"], required: true },
    ],
    action_handler: "region_adjust",
    mapping_status: "unverified",
    writes: [{ object: "region", field: "range" }],
    allowed_flows: ["待确认"],
    change_class: "structure",
  },
  {
    id: "region.weight_set",
    name: "设置 Region 权重",
    params: [
      { name: "curve", type: "curve_ref", required: true },
      { name: "region", type: "region_ref", required: true },
      { name: "weight", type: "number", required: true },
    ],
    action_handler: "region_weight_change",
    mapping_status: "unverified",
    writes: [{ object: "region", field: "weight" }],
    allowed_flows: ["待确认"],
    change_class: "weight",
  },
  {
    id: "target.weight_set",
    name: "设置一组 Target 的权重",
    params: [
      { name: "targets", type: "target_set_ref", required: true },
      { name: "weight", type: "number", required: true },
    ],
    action_handler: "target_weight_change",
    mapping_status: "unverified",
    writes: [{ object: "targets", field: "weight" }],
    allowed_flows: ["待确认"],
    change_class: "weight",
  },
  {
    id: "plot.add",
    name: "新增参与优化的 Plot",
    params: [
      { name: "plot_type", type: "plot_type_ref", required: true },
      { name: "data_source", type: "data_ref", required: true },
      { name: "curve", type: "curve_ref", required: true },
      { name: "region", type: "range_ref", required: false },
    ],
    action_handler: "plot_add",
    mapping_status: "unverified",
    writes: [{ object: "curve", field: "plots" }],
    allowed_flows: ["待确认"],
    change_class: "structure",
  },
  {
    id: "loss.change",
    name: "更换已注册损失函数",
    params: [
      { name: "plot", type: "plot_ref", required: true },
      { name: "region", type: "region_ref", required: false },
      { name: "loss", type: "loss_ref", required: true },
    ],
    action_handler: "loss_change",
    mapping_status: "unverified",
    writes: [{ object: "plot", field: "loss" }],
    allowed_flows: ["待确认"],
    change_class: "loss",
  },
  {
    id: "optimizer.change",
    name: "更换优化器或插入全局优化",
    params: [
      { name: "flow", type: "flow_ref", required: true },
      { name: "optimizer", type: "optimizer_ref", required: true },
      { name: "insert_after", type: "flow_step_ref", required: false },
    ],
    action_handler: "optimizer_change",
    mapping_status: "unverified",
    writes: [{ object: "flow", field: "optimizer" }],
    allowed_flows: ["待确认"],
    change_class: "optimizer",
  },
  {
    id: "optimizer.iteration_set",
    name: "设置优化迭代次数",
    params: [
      { name: "flow", type: "flow_ref", required: true },
      { name: "iterations", type: "integer", required: true },
    ],
    action_handler: "optimizer_iteration_set",
    mapping_status: "unverified",
    writes: [{ object: "flow", field: "iteration_limit" }],
    allowed_flows: ["待确认"],
    change_class: "optimizer",
  },
  {
    id: "param.boundary_set",
    name: "调整单个参数边界",
    params: [
      { name: "parameter", type: "parameter_ref", required: true },
      { name: "lower", type: "number", required: false },
      { name: "upper", type: "number", required: false },
      { name: "scope", type: "optimization_scope_ref", required: true },
    ],
    rules: ["at_least_one(lower, upper)"],
    action_handler: "param_boundary_set",
    mapping_status: "unverified",
    writes: [{ object: "parameter", field: "boundary" }],
    allowed_flows: ["待确认"],
    change_class: "parameter",
  },
  {
    id: "param.add",
    name: "增加待优化参数",
    params: [
      { name: "flow", type: "flow_ref", required: true },
      { name: "parameters", type: "parameter_set_ref", required: true },
    ],
    action_handler: "param_add",
    mapping_status: "unverified",
    writes: [{ object: "flow", field: "tunable_parameters" }],
    allowed_flows: ["待确认"],
    change_class: "parameter",
  },
  {
    id: "param.bin_enable",
    name: "对 Global 参数开 Bin",
    params: [
      { name: "flow", type: "flow_ref", required: true },
      { name: "parameters", type: "parameter_set_ref", required: true },
      { name: "bin", type: "bin_ref", required: true },
    ],
    action_handler: "param_bin_enable",
    mapping_status: "unverified",
    writes: [{ object: "parameters", field: "bin_mode" }],
    allowed_flows: ["待确认"],
    change_class: "parameter",
  },
  {
    id: "pr.run",
    name: "执行一轮 PR",
    params: [
      { name: "flow", type: "flow_ref", required: true },
      { name: "opt_weight", type: "number", required: true },
      { name: "parameters", type: "parameter_set_ref", required: true },
      { name: "devices", type: "device_set_ref", required: false },
    ],
    action_handler: "pr_run",
    mapping_status: "unverified",
    writes: [
      { object: "parameters", field: "values" },
      { object: "devices", field: "parameter_trend" },
    ],
    allowed_flows: ["待确认"],
    change_class: "optimization",
  },
  {
    id: "ps.run",
    name: "执行一轮 PS",
    params: [
      { name: "flow", type: "flow_ref", required: true },
      { name: "objective", type: "enum", values: ["accuracy", "linearity", "monotonicity", "anti_trend"], required: true },
      { name: "targets", type: "target_set_ref", required: true },
      { name: "parameters", type: "parameter_set_ref", required: true },
      { name: "devices", type: "device_set_ref", required: false },
      { name: "interpolation_weight", type: "weight_rule", required: false },
    ],
    action_handler: "ps_run",
    mapping_status: "unverified",
    writes: [
      { object: "targets", field: "values" },
      { object: "targets", field: "trend" },
    ],
    allowed_flows: ["待确认"],
    change_class: "optimization",
  },
  {
    id: "param.propagate",
    name: "传递参数与边界",
    params: [
      { name: "source_flow", type: "flow_ref", required: true },
      { name: "target_flow", type: "flow_ref", required: true },
      { name: "parameters", type: "parameter_set_ref", required: true },
      { name: "include_boundaries", type: "boolean", required: true },
      { name: "source_device", type: "device_ref", required: false },
      { name: "target_devices", type: "device_set_ref", required: false },
      { name: "overwrite", type: "enum", values: ["preserve_existing", "replace_existing"], required: true },
    ],
    action_handler: "param_propagate",
    mapping_status: "unverified",
    writes: [
      { object: "target_flow", field: "parameters" },
      { object: "target_flow", field: "parameter_boundaries" },
    ],
    allowed_flows: ["待确认"],
    change_class: "parameter",
  },
  {
    id: "data.interpolate",
    name: "对缺失 Point 插值赋值",
    params: [
      { name: "curve", type: "curve_ref", required: true },
      { name: "points", type: "point_set_ref", required: true },
      { name: "method", type: "interpolation_method_ref", required: true },
    ],
    action_handler: "data_interpolate",
    mapping_status: "unverified",
    writes: [{ object: "points", field: "measured_values" }],
    allowed_flows: ["待确认"],
    change_class: "data",
  },
  {
    id: "data.param_copy",
    name: "传递 Point 参数值",
    params: [
      { name: "source_point", type: "point_ref", required: true },
      { name: "target_points", type: "point_set_ref", required: true },
      { name: "parameters", type: "parameter_set_ref", required: true },
    ],
    action_handler: "data_param_copy",
    mapping_status: "unverified",
    writes: [{ object: "target_points", field: "parameter_values" }],
    allowed_flows: ["待确认"],
    change_class: "data",
  },
  {
    id: "data.remove",
    name: "删除指定异常数据",
    params: [
      { name: "device", type: "device_ref", required: true },
      { name: "temperature", type: "temperature_point", required: true },
      { name: "curves", type: "curve_ref_list", required: true },
      { name: "points", type: "point_set_ref", required: true },
    ],
    action_handler: "data_remove",
    mapping_status: "unverified",
    writes: [{ object: "points", field: "fitting_membership" }],
    allowed_flows: ["待确认"],
    change_class: "data",
    destructive: true,
    confirm_required: true,
  },
];

const slotLabels = {
  curve: "曲线",
  region: "Region",
  range: "范围",
  new_range: "新范围",
  weight: "权重",
  mode: "调整方式",
  targets: "Target 集合",
  plot_type: "Plot 类型",
  data_source: "数据源",
  plot: "Plot",
  loss: "损失函数",
  flow: "流程",
  optimizer: "优化器",
  insert_after: "插入位置",
  iterations: "迭代次数",
  parameter: "参数",
  lower: "下界",
  upper: "上界",
  scope: "作用域",
  parameters: "参数集合",
  bin: "Bin",
  opt_weight: "优化权重",
  devices: "器件集合",
  objective: "目标",
  interpolation_weight: "插值权重",
  source_flow: "来源流程",
  target_flow: "目标流程",
  include_boundaries: "是否包含边界",
  source_device: "来源器件",
  target_devices: "目标器件",
  overwrite: "覆盖方式",
  points: "Point 集合",
  method: "插值方法",
  source_point: "来源 Point",
  target_points: "目标 Point",
  device: "器件",
  temperature: "温度",
  curves: "曲线列表",
};

function parseRule(text) {
  const match = text.match(/^at_least_one\((.+)\)$/);
  if (!match) throw new Error(`无法解析规则 ${text}`);
  return { kind: "at_least_one", names: match[1].split(",").map((name) => name.trim()) };
}

function buildAction(spec) {
  return {
    id: spec.action_handler,
    kind: "action",
    stepId: spec.id,
    summary: spec.name,
    changeClass: spec.change_class,
    mappingStatus: spec.mapping_status,
    destructive: Boolean(spec.destructive),
    confirmRequired: Boolean(spec.confirm_required),
    writes: spec.writes,
    params: spec.params.map((param) => ({
      name: param.name,
      type: param.type,
      required: param.required,
      values: param.values || [],
      fill: "slot",
      slot: param.name,
    })),
    returns: spec.writes.map((write) => ({ name: `${write.object}.${write.field}`, type: "field" })),
    rules: (spec.rules || []).map(parseRule),
  };
}

const apiLibrary = stepSpecs.map(buildAction);
const actionHandlers = new Set(stepSpecs.map((spec) => spec.action_handler));
if (apiLibrary.some((item) => !actionHandlers.has(item.id))) {
  throw new Error("API 库出现了步骤 action_handler 以外的名称");
}

const stepLibrary = stepSpecs.map((spec) => ({
  id: spec.id,
  summary: spec.name,
  apis: [spec.action_handler],
  mappingStatus: spec.mapping_status,
  allowedFlows: spec.allowed_flows,
  changeClass: spec.change_class,
  writes: spec.writes,
  destructive: Boolean(spec.destructive),
  confirmRequired: Boolean(spec.confirm_required),
}));


function getApi(id) {
  return apiLibrary.find((item) => item.id === id) || null;
}

function getStep(id) {
  return stepLibrary.find((item) => item.id === id) || null;
}

function paramType(param) {
  return param.values.length ? `enum[${param.values.join("|")}]` : param.type;
}

function catalogForSteps() {
  return stepLibrary
    .map((step) => {
      const params = getApi(step.apis[0])
        .params.map((param) => `${param.name}: ${paramType(param)}${param.required ? "" : "?"}`)
        .join(", ");
      return `- ${step.id}（${step.summary}）参数 ${params}；mapping_status=${step.mappingStatus}；allowed_flows=${step.allowedFlows.join("、")}；展开为 ${step.apis[0]}`;
    })
    .join("\n");
}

function catalogForApis() {
  return apiLibrary
    .map((item) => {
      const args = item.params.map((param) => `${param.name}: ${paramType(param)}${param.required ? "" : "?"}`).join(", ");
      const returns = item.returns.map((entry) => entry.name).join(", ");
      return `- ${item.id}(${args}) -> ${returns}    ${item.summary}`;
    })
    .join("\n");
}

const planSystem = [
  "你把自然语言规划成步骤列表。只输出一个 JSON 对象，不要写解释。",
  '格式：{"steps":[{"id":"步骤 id","params":{"参数名":"值"}}]}',
  "规则：",
  "1. id 只能来自用户消息里的步骤库。",
  "2. 不要输出步骤库以外的 id。",
  "3. params 只填原话里能够确定的值。确定不了就不要写这个参数。",
  "4. 枚举参数只能使用给定的取值。",
  '5. 如果原话和步骤库无关，输出 {"steps":[]}。',
].join("\n");

const codeSystem = [
  "你把自然语言写成 API 调用。只输出一个 JSON 对象，不要写解释。",
  '格式：{"calls":[{"api":"函数名","params":{"参数名":"值"}}]}',
  "规则：",
  "1. api 只能使用用户消息里 API 库中的函数名。",
  "2. 不要调用库外函数，也不要发明解析函数。",
  "3. params 只填原话里能够确定的值。",
  "4. 枚举参数只能使用签名里给出的取值。",
  '5. 如果原话和 API 库无关，输出 {"calls":[]}。',
].join("\n");

const presetSystem = [
  "你在已经确认可以执行的流程里选择步骤。只输出一个 JSON 对象，不要写解释。",
  '格式：{"steps":["步骤 id"]}',
  "规则：",
  "1. 只有 mapping_status 为 verified，并且 allowed_flows 不是「待确认」的步骤才能入选。",
  "2. 不满足条件的步骤不要输出。",
  '3. 如果没有可执行步骤，输出 {"steps":[]}。',
].join("\n");

function buildRequests(text) {
  const utterance = text.trim() || "（空）";
  const steps = catalogForSteps();
  const apis = catalogForApis();
  return [
    { id: "plan", system: planSystem, user: `步骤库：\n${steps}\n\n用户原话：${utterance}` },
    { id: "code", system: codeSystem, user: `API 库：\n${apis}\n\n用户原话：${utterance}` },
    { id: "preset", system: presetSystem, user: `步骤状态：\n${steps}\n\n用户原话：${utterance}` },
  ];
}

function parseModelJson(raw) {
  if (raw === undefined || raw === null || !String(raw).trim()) {
    return { ok: false, error: "模型没有返回内容", value: null };
  }
  let text = String(raw).trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const attempt = (value) => {
    try {
      return { ok: true, value: JSON.parse(value) };
    } catch (error) {
      return { ok: false, error: `模型输出不是 JSON：${error.message}`, value: null };
    }
  };
  const direct = attempt(text);
  if (direct.ok) return direct;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return attempt(text.slice(start, end + 1));
  return direct;
}

function formatGiven(param, value) {
  const text = typeof value === "string" ? value : String(value);
  if (param.type === "number" || param.type === "integer" || param.type === "boolean") return text;
  return `"${text}"`;
}

function applyRules(api, params) {
  for (const rule of api.rules) {
    if (rule.kind !== "at_least_one") continue;
    const group = params.filter((param) => rule.names.includes(param.name));
    const filled = group.some((param) => param.value !== "<缺失>" && param.value !== "<未提供>");
    if (filled) continue;
    for (const param of group) {
      param.missing = true;
      param.value = "<缺失>";
      param.source = `规则 at_least_one(${rule.names.join(", ")})，至少要有一个值`;
    }
  }
  return params;
}

function bindParams(api, provided, extra) {
  const source = provided && typeof provided === "object" ? provided : {};
  const known = new Set(api.params.map((param) => param.name));
  for (const name of Object.keys(source)) {
    if (!known.has(name)) extra.push(`${api.id} 的参数 ${name} 不在签名里，已忽略`);
  }
  const params = api.params.map((param) => {
    const raw = source[param.name];
    const empty = raw === undefined || raw === null || String(raw).trim() === "";
    const label = slotLabels[param.name] || param.name;
    if (!empty && param.values.length && !param.values.includes(String(raw))) {
      return {
        name: param.name,
        value: "<缺失>",
        source: `模型给出的 ${raw} 不在枚举 ${param.values.join("、")} 内`,
        missing: true,
      };
    }
    if (!empty) return { name: param.name, value: formatGiven(param, raw), source: "模型从原话填写", missing: false };
    return {
      name: param.name,
      value: param.required ? "<缺失>" : "<未提供>",
      source: param.required ? `模型没有给出${label}` : `可选，模型没有给出${label}`,
      missing: param.required,
    };
  });
  return applyRules(api, params);
}

function makeCall(api, provided, extra) {
  return {
    api: api.id,
    summary: api.summary,
    params: bindParams(api, provided, extra),
    confirmRequired: api.confirmRequired,
    destructive: api.destructive,
  };
}

function formatCall(call, index) {
  const args = call.params.map((param) => `${param.name}=${param.value}`).join(", ");
  return `${index}. ${call.api}(${args})`;
}

function formatList(calls) {
  if (calls.length === 0) return "（空列表）";
  return calls.map((call, index) => formatCall(call, index + 1)).join("\n");
}

function toCode(calls) {
  if (calls.length === 0) return "# 没有生成调用";
  return calls
    .map((call, index) => {
      const args = call.params.map((param) => `${param.name}=${param.value === "<缺失>" || param.value === "<未提供>" ? `"${param.value}"` : param.value}`).join(", ");
      return `step${index + 1} = ${call.api}(${args})`;
    })
    .join("\n");
}

function writeConflicts(steps) {
  const seen = new Map();
  const lines = [];
  for (const step of steps) {
    for (const write of step.writes) {
      const key = `${write.object}.${write.field}`;
      if (seen.has(key)) lines.push(`${key} 同时被 ${seen.get(key)} 和 ${step.id} 写入`);
      else seen.set(key, step.id);
    }
  }
  return lines;
}

function modelStage(reply) {
  if (!reply) return "没有收到模型响应。";
  if (reply.error) return reply.error;
  return reply.text && String(reply.text).trim() ? String(reply.text) : "模型没有返回内容。";
}

function realizePlan(_text, reply) {
  const title = "先规划列表，再展开";
  const summary = "模型从步骤库里选步骤并填写参数。程序只展开选中步骤的 action_handler，库外步骤会被丢掉。";
  if (!reply || reply.error) {
    return { id: "plan", title, summary, stages: [{ title: "1. 模型调用", body: modelStage(reply) }], calls: [], text: formatList([]) };
  }
  const parsed = parseModelJson(reply.text);
  const notes = [];
  const accepted = [];
  const calls = [];
  if (!parsed.ok) notes.push(parsed.error);
  const steps = parsed.ok && Array.isArray(parsed.value.steps) ? parsed.value.steps : [];
  if (parsed.ok && !Array.isArray(parsed.value.steps)) notes.push("模型输出里没有 steps 数组。");
  for (const entry of steps) {
    const id = typeof entry === "string" ? entry : entry && entry.id;
    const provided = entry && typeof entry === "object" ? entry.params : {};
    const step = getStep(id);
    if (!step) {
      notes.push(`模型给出了库外步骤 ${id || "（空）"}，已丢弃`);
      continue;
    }
    accepted.push(step);
    calls.push(makeCall(getApi(step.apis[0]), provided, notes));
  }
  const conflicts = writeConflicts(accepted);
  return {
    id: "plan",
    title,
    summary,
    stages: [
      { title: "1. 模型原文", body: modelStage(reply) },
      { title: "2. 名称校验", body: notes.length ? notes.join("\n") : "给出的步骤都在步骤库里。" },
      { title: "3. 展开成 API", body: formatList(calls) },
      { title: "4. 按 writes 检查改动冲突", body: conflicts.length ? conflicts.join("\n") : "选中的步骤没有写同一个字段。" },
    ],
    calls,
    text: formatList(calls),
  };
}

function realizeCode(_text, reply) {
  const title = "先生成调用代码，再抽出列表";
  const summary = "模型按 API 库写调用。程序核对函数名必须是 action_handler，库外名称会被丢掉。";
  if (!reply || reply.error) {
    return { id: "code", title, summary, stages: [{ title: "1. 模型调用", body: modelStage(reply) }], calls: [], text: formatList([]) };
  }
  const parsed = parseModelJson(reply.text);
  const notes = [];
  const calls = [];
  const steps = [];
  if (!parsed.ok) notes.push(parsed.error);
  const items = parsed.ok && Array.isArray(parsed.value.calls) ? parsed.value.calls : [];
  if (parsed.ok && !Array.isArray(parsed.value.calls)) notes.push("模型输出里没有 calls 数组。");
  for (const entry of items) {
    const id = entry && entry.api;
    const api = getApi(id);
    if (!api) {
      notes.push(`模型给出了库外 API ${id || "（空）"}，已丢弃`);
      continue;
    }
    const step = stepLibrary.find((item) => item.apis[0] === api.id);
    if (step) steps.push(step);
    calls.push(makeCall(api, entry.params, notes));
  }
  const conflicts = writeConflicts(steps);
  const check = calls.length === 0 ? "没有保留下来的调用。" : calls.map((call) => `${call.api}：是步骤库中的 action_handler`).join("\n");
  return {
    id: "code",
    title,
    summary,
    stages: [
      { title: "1. 模型原文", body: modelStage(reply) },
      { title: "2. 名称校验", body: notes.length ? notes.join("\n") : "给出的函数名都在 API 库里。" },
      { title: "3. 生成的代码", body: toCode(calls) },
      { title: "4. 对照 API 库做静态检查", body: check },
      { title: "5. 按 writes 检查改动冲突", body: conflicts.length ? conflicts.join("\n") : "选中的步骤没有写同一个字段。" },
    ],
    calls,
    text: formatList(calls),
  };
}

function executable(step) {
  return step.mappingStatus === "verified" && step.allowedFlows.some((flow) => flow && flow !== "待确认");
}

function realizePreset(_text, reply) {
  const title = "按预先写好的流程展开";
  const summary = "模型只能在 mapping_status 已核对、allowed_flows 已确认的步骤里选。这份库两项都还没补，所以列表为空。";
  if (!reply || reply.error) {
    return { id: "preset", title, summary, stages: [{ title: "1. 模型调用", body: modelStage(reply) }], calls: [], text: formatList([]) };
  }
  const parsed = parseModelJson(reply.text);
  const chosen = [];
  if (!parsed.ok) chosen.push(parsed.error);
  const steps = parsed.ok && Array.isArray(parsed.value.steps) ? parsed.value.steps : [];
  if (parsed.ok && !Array.isArray(parsed.value.steps)) chosen.push("模型输出里没有 steps 数组。");
  const calls = [];
  const accepted = [];
  if (steps.length === 0 && parsed.ok) chosen.push("模型没有选出步骤。");
  for (const entry of steps) {
    const id = typeof entry === "string" ? entry : entry && entry.id;
    const step = getStep(id);
    if (!step) {
      chosen.push(`模型给出了库外步骤 ${id || "（空）"}，已丢弃`);
      continue;
    }
    if (!executable(step)) {
      chosen.push(`${step.id}：mapping_status=${step.mappingStatus}，allowed_flows=${step.allowedFlows.join("、")}。不能进入 executable 方案。`);
      continue;
    }
    accepted.push(step);
    const provided = entry && typeof entry === "object" ? entry.params : {};
    calls.push(makeCall(getApi(step.apis[0]), provided, chosen));
  }
  if (calls.length === 0) chosen.push("API 列表为空。");
  return {
    id: "preset",
    title,
    summary,
    stages: [
      { title: "1. 模型原文", body: modelStage(reply) },
      { title: "2. 能否进入 executable 方案", body: chosen.join("\n") },
    ],
    calls,
    text: formatList(calls),
  };
}

function realize(text, replies) {
  const byId = new Map((replies || []).map((reply) => [reply.id, reply]));
  return {
    requests: buildRequests(text),
    results: [realizePlan(text, byId.get("plan")), realizeCode(text, byId.get("code")), realizePreset(text, byId.get("preset"))],
  };
}

const api = { apiLibrary, stepLibrary, buildRequests, parseModelJson, realize };
globalThis.NL2Task = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
