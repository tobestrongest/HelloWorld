// 步骤库来自 steps.yaml。API 库按这份文件生成，规则有三条：
// 1. 每个步骤生成一个动作 API，id 用 action_handler，参数照抄，返回值照抄 writes。
// 2. 参数类型是引用时，再生成一个解析 API。动作 API 的这个参数改为取解析 API 的返回值。
// 3. 数值、枚举、布尔、温度这些字面量仍从原话的槽位里取。
// 匹配关键词是写死的，用来把三种方案的差异固定下来。这里不调用真实接口，也不调用大模型。

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

const matchers = {
  "region.create": {
    when: "出现「新建 / 创建」并且提到 Region",
    match(text) {
      return /region/i.test(text) && /新建|创建/.test(text);
    },
  },
  "region.adjust": {
    when: "提到 Region 和边界，并且有「调整 / 扩大 / 缩小 / 扩到 / 缩到」",
    match(text) {
      return /region/i.test(text) && /边界/.test(text) && /调整|扩大|缩小|扩到|缩到|向外|向内/.test(text);
    },
  },
  "region.weight_set": {
    when: "提到 Region，并且用「设置 / 设为 / 改成 / 改为」说明权重",
    match(text) {
      return /region/i.test(text) && /权重/.test(text) && /设置|设为|改成|改为/.test(text);
    },
  },
  "target.weight_set": {
    when: "提到 Target，并且用「设置 / 设为 / 改成 / 改为」说明权重",
    match(text) {
      return /target/i.test(text) && /权重/.test(text) && /设置|设为|改成|改为/.test(text);
    },
  },
  "plot.add": {
    when: "提到 Plot，并且有「新增 / 加一个 / 添加」",
    match(text) {
      return /plot/i.test(text) && /新增|加一个|添加|加上/.test(text);
    },
  },
  "loss.change": {
    when: "提到损失函数",
    match(text) {
      return /损失函数/.test(text);
    },
  },
  "optimizer.change": {
    when: "提到优化器",
    match(text) {
      return /优化器/.test(text);
    },
  },
  "optimizer.iteration_set": {
    when: "提到迭代次数",
    match(text) {
      return /迭代/.test(text);
    },
  },
  "param.boundary_set": {
    when: "提到参数，并且有「边界 / 下界 / 上界」",
    match(text) {
      return /参数/.test(text) && /边界|下界|上界/.test(text) && !/传递|传到/.test(text);
    },
  },
  "param.add": {
    when: "提到增加待优化参数",
    match(text) {
      return /参数/.test(text) && /优化/.test(text) && /增加|添加|加入/.test(text);
    },
  },
  "param.bin_enable": {
    when: "提到 Bin",
    match(text) {
      return /bin/i.test(text);
    },
  },
  "pr.run": {
    when: "提到执行一轮 PR",
    match(text) {
      return /跑|执行|运行|做/.test(text) && /(?<![A-Za-z])PR(?![A-Za-z])/.test(text);
    },
  },
  "ps.run": {
    when: "提到执行一轮 PS",
    match(text) {
      return /跑|执行|运行|做/.test(text) && /(?<![A-Za-z])PS(?![A-Za-z])/.test(text);
    },
  },
  "param.propagate": {
    when: "提到把参数传到另一个流程",
    match(text) {
      return /参数/.test(text) && /流程/.test(text) && /传/.test(text) && !/point/i.test(text);
    },
  },
  "data.interpolate": {
    when: "提到插值",
    match(text) {
      return /插值/.test(text) && !/插值权重/.test(text);
    },
  },
  "data.param_copy": {
    when: "提到传递或复制 Point 的参数值",
    match(text) {
      return /point/i.test(text) && /参数/.test(text) && /传|拷|复制/.test(text);
    },
  },
  "data.remove": {
    when: "提到删除数据",
    match(text) {
      return /删除|删掉|去掉/.test(text) && /数据/.test(text);
    },
  },
};

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
  plot_region: "Plot 使用的范围",
};

const resolvers = [];
const resolverById = new Map();

function isRef(type) {
  return type.endsWith("_ref") || type.endsWith("_ref_list");
}

function slotKey(param) {
  if (param.name === "region" && param.type === "range_ref") return "plot_region";
  return param.name;
}

function resolverId(param) {
  if (param.name === "region" && param.type === "range_ref") return "region_range_resolve";
  return `${param.name}_resolve`;
}

function returnField(param) {
  const many = param.type.includes("_set_") || param.type.endsWith("_list");
  return `${param.name}_${many ? "ids" : "id"}`;
}

function ensureResolver(param) {
  const id = resolverId(param);
  const existing = resolverById.get(id);
  if (existing) return existing;
  const field = returnField(param);
  const slot = slotKey(param);
  const resolver = {
    id,
    kind: "resolve",
    summary: `${slotLabels[slot] || param.name}（${param.type}）`,
    params: [{ name: "name", type: "string", required: true, fill: "slot", slot, values: [] }],
    returns: [{ name: field, type: param.type }],
    rules: [],
    relevant() {
      return false;
    },
    relevantReason: "由引用类型生成。原话不直接选它，代码方案在动作 API 需要这个参数时补上",
  };
  resolverById.set(id, resolver);
  resolvers.push(resolver);
  return resolver;
}

function parseRule(text) {
  const match = text.match(/^at_least_one\((.+)\)$/);
  if (!match) throw new Error(`无法解析规则 ${text}`);
  return { kind: "at_least_one", names: match[1].split(",").map((name) => name.trim()) };
}

function buildAction(spec) {
  const matcher = matchers[spec.id];
  if (!matcher) throw new Error(`缺少匹配规则 ${spec.id}`);
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
    params: spec.params.map((param) => {
      const base = {
        name: param.name,
        type: param.type,
        required: param.required,
        values: param.values || [],
      };
      if (!isRef(param.type)) return { ...base, fill: "slot", slot: param.name };
      const resolver = ensureResolver(param);
      return {
        ...base,
        fill: "output",
        from: { api: resolver.id, field: resolver.returns[0].name },
        slot: slotKey(param),
      };
    }),
    returns: spec.writes.map((write) => ({ name: `${write.object}.${write.field}`, type: "field" })),
    rules: (spec.rules || []).map(parseRule),
    relevant: matcher.match,
    relevantReason: matcher.when,
  };
}

const actionApis = stepSpecs.map(buildAction);
const apiLibrary = [...resolvers, ...actionApis];

const stepLibrary = stepSpecs.map((spec) => {
  const matcher = matchers[spec.id];
  return {
    id: spec.id,
    summary: spec.name,
    when: matcher.when,
    apis: [spec.action_handler],
    match: matcher.match,
    mappingStatus: spec.mapping_status,
    allowedFlows: spec.allowed_flows,
    changeClass: spec.change_class,
    writes: spec.writes,
    destructive: Boolean(spec.destructive),
    confirmRequired: Boolean(spec.confirm_required),
  };
});

function getApi(id) {
  const found = apiLibrary.find((item) => item.id === id);
  if (!found) throw new Error(`API 库中没有 ${id}`);
  return found;
}

function normalizeRange(value) {
  return value.replace(/\s+/g, " ").trim();
}

function lastNumber(text, pattern) {
  const found = [...text.matchAll(pattern)];
  return found.length ? found.at(-1)[1] : undefined;
}

function extractSlots(text) {
  const slots = {};
  const curve = text.match(/曲线\s*([A-Za-z][A-Za-z0-9_]*)/);
  if (curve) slots.curve = curve[1];
  const curveList = text.match(/曲线\s*([A-Za-z][A-Za-z0-9_]*(?:\s*[,，、]\s*[A-Za-z][A-Za-z0-9_]*)+)/);
  if (curveList) slots.curves = curveList[1].replace(/\s+/g, "");

  const region = text.match(/region\s*([A-Za-z][A-Za-z0-9_]*)/i);
  if (region) slots.region = region[1];

  const range = text.match(/范围\s*([0-9.]+\s*(?:到|至|-)\s*[0-9.]+)/);
  if (range) slots.range = normalizeRange(range[1]);
  const shifted = text.match(/(?:扩到|缩到)\s*([0-9.]+\s*(?:到|至|-)\s*[0-9.]+)/);
  if (shifted) slots.new_range = normalizeRange(shifted[1]);

  const weight = lastNumber(text, /(?<!优化)权重\s*(?:设为|改为|改成|为|是|设成)?\s*([0-9.]+)/g);
  if (weight) slots.weight = weight;
  const optWeight = text.match(/优化权重\s*([0-9.]+)/);
  if (optWeight) slots.opt_weight = optWeight[1];

  if (/缩到|缩小|向内/.test(text)) slots.mode = "shrink";
  else if (/扩到|扩大|向外/.test(text)) slots.mode = "expand";

  if (/已注册/.test(text) && /target/i.test(text)) slots.targets = "registered";
  const targets = text.match(/target\s*([A-Za-z][A-Za-z0-9_]*(?:\s*[,，、]\s*[A-Za-z0-9_]+)*)/i);
  if (targets) slots.targets = targets[1].replace(/\s+/g, "");

  const plotType = text.match(/plot\s*类型\s*([A-Za-z0-9_]+)/i);
  if (plotType) slots.plot_type = plotType[1];
  const plot = text.match(/plot\s*([A-Za-z][A-Za-z0-9_]*)/i);
  if (plot && !/^类型$/i.test(plot[1])) slots.plot = plot[1];

  const dataSource = text.match(/数据(?:来自|源为|源是|源)\s*([A-Za-z0-9_]+)/);
  if (dataSource) slots.data_source = dataSource[1];

  const loss = text.match(/损失函数\s*(?:换成|改为|改成|为|用)\s*([A-Za-z0-9_-]+)/);
  if (loss) slots.loss = loss[1];

  const flows = [...text.matchAll(/流程\s*([A-Za-z][A-Za-z0-9_]*)/g)].map((match) => match[1]);
  if (flows[0]) slots.flow = flows[0];
  if (flows[0] && flows[1]) {
    slots.source_flow = flows[0];
    slots.target_flow = flows[1];
  }

  const optimizer = text.match(/优化器\s*(?:换成|改为|改成|为|用)\s*([A-Za-z][A-Za-z0-9_-]*)/);
  if (optimizer) slots.optimizer = optimizer[1];
  const insertAfter = text.match(/插在\s*([A-Za-z0-9_]+)\s*之后/);
  if (insertAfter) slots.insert_after = insertAfter[1];
  const iterations = text.match(/迭代\s*([0-9]+)\s*次/);
  if (iterations) slots.iterations = iterations[1];

  const parameterList = text.match(/参数\s*([A-Za-z][A-Za-z0-9_]*(?:\s*[,，、和]\s*[A-Za-z][A-Za-z0-9_]*)+)/);
  if (parameterList) {
    slots.parameters = parameterList[1].replace(/\s*(?:和|,|，|、)\s*/g, ",");
    slots.parameter = slots.parameters.split(",")[0];
  } else {
    const parameter = text.match(/参数\s*([A-Za-z][A-Za-z0-9_]*)/);
    if (parameter) {
      slots.parameter = parameter[1];
      slots.parameters = parameter[1];
    }
  }
  if (/全部参数|所有参数|full_set/.test(text)) slots.parameters = "full_set";
  if (/当前参数/.test(text)) slots.parameters = "current";

  const lower = text.match(/下界\s*(?:调到|设为|改为|为)?\s*(-?[0-9.]+)/);
  if (lower) slots.lower = lower[1];
  const upper = text.match(/上界\s*(?:调到|设为|改为|为)?\s*(-?[0-9.]+)/);
  if (upper) slots.upper = upper[1];
  if (/global/i.test(text)) slots.scope = "global";
  else if (/local/i.test(text)) slots.scope = "local";

  const bin = text.match(/bin\s*([A-Za-z0-9_]+)/i);
  if (bin) slots.bin = bin[1];

  if (/全部器件|所有器件/.test(text)) slots.devices = "all";
  const deviceList = text.match(/器件\s*([A-Za-z][A-Za-z0-9_]*(?:\s*[,，、]\s*[A-Za-z][A-Za-z0-9_]*)+)/);
  if (deviceList) slots.devices = deviceList[1].replace(/\s+/g, "");
  const device = text.match(/器件\s*([A-Za-z][A-Za-z0-9_]*)/);
  if (device) slots.device = device[1];

  if (/精度/.test(text)) slots.objective = "accuracy";
  else if (/单调/.test(text)) slots.objective = "monotonicity";
  else if (/反趋势/.test(text)) slots.objective = "anti_trend";
  else if (/线性/.test(text) && !/线性插值/.test(text)) slots.objective = "linearity";

  if (/same_as_target|与\s*target\s*相同/i.test(text)) slots.interpolation_weight = "same_as_target";
  const interpolationWeight = text.match(/插值权重\s*([0-9.]+)/);
  if (interpolationWeight) slots.interpolation_weight = interpolationWeight[1];

  if (/不含边界|不包括边界/.test(text)) slots.include_boundaries = "false";
  else if (/包含边界|和边界|连同边界/.test(text)) slots.include_boundaries = "true";
  if (/保留已有|保留现有/.test(text)) slots.overwrite = "preserve_existing";
  else if (/覆盖已有|覆盖现有|覆盖/.test(text)) slots.overwrite = "replace_existing";

  if (/全部\s*point|所有\s*point/i.test(text)) slots.points = "all";
  else if (/缺失/.test(text) && /point/i.test(text)) slots.points = "missing";
  if (/线性插值/.test(text)) slots.method = "linear";
  const method = text.match(/插值方法\s*(?:为|用)?\s*([A-Za-z0-9_]+)/);
  if (method) slots.method = method[1];

  const sourcePoint = text.match(/point\s*([A-Za-z0-9_]+)/i);
  if (sourcePoint && !/^(集合|参数)$/i.test(sourcePoint[1])) slots.source_point = sourcePoint[1];
  if (/其他\s*point|别的\s*point/i.test(text)) slots.target_points = "others";

  const temperature = text.match(/(-?[0-9.]+)\s*度/);
  if (temperature) slots.temperature = temperature[1];
  return slots;
}

function describeSlots(slots) {
  const entries = Object.entries(slots);
  if (entries.length === 0) return "没有从原话里识别出参数值。";
  return entries.map(([key, value]) => `${slotLabels[key] || key} = ${value}`).join("，");
}

function formatSlotValue(param, value) {
  if (param.type === "number" || param.type === "integer" || param.type === "boolean") return String(value);
  return `"${value}"`;
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

function bindCall(apiId, previous, slots) {
  const found = getApi(apiId);
  const params = applyRules(
    found,
    found.params.map((param) => {
      if (param.fill === "slot") {
        const value = slots[param.slot];
        if (value) {
          return { name: param.name, value: formatSlotValue(param, value), source: "用户输入", missing: false };
        }
        const label = slotLabels[param.slot] || param.slot;
        return {
          name: param.name,
          value: param.required ? "<缺失>" : "<未提供>",
          source: param.required ? `用户输入里没有${label}` : `可选，用户输入里没有${label}`,
          missing: param.required,
        };
      }
      const producerIndex = previous.findIndex((call) => call.api === param.from.api);
      if (producerIndex >= 0) {
        return {
          name: param.name,
          value: `$${producerIndex + 1}.${param.from.field}`,
          source: `第 ${producerIndex + 1} 步 ${param.from.api} 的 ${param.from.field}`,
          missing: false,
        };
      }
      return {
        name: param.name,
        value: param.required ? "<缺失>" : "<未提供>",
        source: `API 库要求来自 ${param.from.api}.${param.from.field}，这次列表里没有该调用`,
        missing: param.required,
      };
    }),
  );
  return {
    api: found.id,
    summary: found.summary,
    params,
    confirmRequired: found.confirmRequired,
    destructive: found.destructive,
  };
}

function expandSteps(steps, slots) {
  const calls = [];
  for (const step of steps) {
    for (const apiId of step.apis) calls.push(bindCall(apiId, calls, slots));
  }
  return calls;
}

function formatCall(call, index) {
  const args = call.params.map((param) => `${param.name}=${param.value}`).join(", ");
  return `${index}. ${call.api}(${args})`;
}

function formatList(calls) {
  if (calls.length === 0) return "（空列表）";
  return calls.map((call, index) => formatCall(call, index + 1)).join("\n");
}

function formatSignatures() {
  return apiLibrary
    .map((item) => {
      const args = item.params
        .map((param) => {
          const type = param.values.length ? `enum[${param.values.join("|")}]` : param.type;
          return `${param.name}: ${type}${param.required ? "" : "?"}`;
        })
        .join(", ");
      const returns = item.returns.map((entry) => entry.name).join(", ");
      return `${item.id}(${args}) -> ${returns}    ${item.summary}`;
    })
    .join("\n");
}

function closeProducers(selectedIds, slots) {
  const selected = new Set(selectedIds);
  const reasons = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...selected]) {
      for (const param of getApi(id).params) {
        if (param.fill !== "output" || selected.has(param.from.api)) continue;
        const named = Boolean(slots[param.slot]);
        if (!param.required && !named) continue;
        selected.add(param.from.api);
        reasons.push(
          `${id} 的参数 ${param.name} 需要 ${param.from.api}.${param.from.field}，因此在代码里补上 ${param.from.api}`,
        );
        changed = true;
      }
    }
  }
  return { ids: topological(selected), reasons };
}

function topological(selected) {
  const ids = [...selected];
  const incoming = new Map(ids.map((id) => [id, 0]));
  const next = new Map(ids.map((id) => [id, []]));
  for (const id of ids) {
    for (const param of getApi(id).params) {
      if (param.fill === "output" && selected.has(param.from.api) && param.from.api !== id) {
        next.get(param.from.api).push(id);
        incoming.set(id, incoming.get(id) + 1);
      }
    }
  }
  const ready = ids
    .filter((id) => incoming.get(id) === 0)
    .sort((a, b) => apiLibrary.findIndex((item) => item.id === a) - apiLibrary.findIndex((item) => item.id === b));
  const ordered = [];
  while (ready.length > 0) {
    const id = ready.shift();
    ordered.push(id);
    for (const child of next.get(id)) {
      incoming.set(child, incoming.get(child) - 1);
      if (incoming.get(child) === 0) {
        ready.push(child);
        ready.sort(
          (a, b) => apiLibrary.findIndex((item) => item.id === a) - apiLibrary.findIndex((item) => item.id === b),
        );
      }
    }
  }
  return ordered;
}

function toCode(calls) {
  if (calls.length === 0) return "# 没有生成调用";
  return calls
    .map((call, index) => {
      const args = call.params.map((param) => `${param.name}=${codeValue(param)}`).join(", ");
      return `step${index + 1} = ${call.api}(${args})`;
    })
    .join("\n");
}

function codeValue(param) {
  if (param.value === "<缺失>" || param.value === "<未提供>") return `"${param.value}"`;
  const match = param.value.match(/^\$(\d+)\.(.+)$/);
  if (!match) return param.value;
  return `step${match[1]}.${match[2]}`;
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

function runPlan(text) {
  const slots = extractSlots(text);
  const picked = stepLibrary.filter((step) => step.match(text, slots));
  const calls = expandSteps(picked, slots);
  const taskLines =
    picked.length === 0
      ? "没有步骤被选中。"
      : picked.map((step, index) => `${index + 1}. ${step.id}：${step.summary}`).join("\n");
  const expansion =
    picked.length === 0
      ? "没有可展开的步骤。"
      : picked.map((step) => `${step.id} → ${step.apis.join(" → ")}`).join("\n");
  const conflicts = writeConflicts(picked);
  return {
    id: "plan",
    title: "先规划列表，再展开",
    summary: "先选出步骤，再按步骤库展开成动作 API。解析 API 不在步骤里，引用参数因此保持缺失。",
    stages: [
      { title: "1. 规划出的步骤列表", body: taskLines },
      { title: "2. 用步骤库展开成 API", body: expansion },
      { title: "3. 按 API 库填写参数", body: formatList(calls) },
      {
        title: "4. 按 writes 检查改动冲突",
        body: conflicts.length === 0 ? "选中的步骤没有写同一个字段。" : conflicts.join("\n"),
      },
    ],
    calls,
    text: formatList(calls),
  };
}

function runCode(text) {
  const slots = extractSlots(text);
  const actions = apiLibrary.filter((item) => item.kind === "action");
  const judged = actions.map((item) => ({ item, hit: item.relevant(text, slots) }));
  const initial = judged.filter((entry) => entry.hit).map((entry) => entry.item.id);
  const closed = closeProducers(initial, slots);
  const calls = [];
  for (const id of closed.ids) calls.push(bindCall(id, calls, slots));
  const retrieval = judged
    .map((entry) => `${entry.hit ? "选用" : "跳过"}  ${entry.item.id}    ${entry.item.relevantReason}`)
    .join("\n");
  const pickedSteps = stepLibrary.filter((step) => initial.includes(step.apis[0]));
  const conflicts = writeConflicts(pickedSteps);
  const check =
    calls.length === 0
      ? "没有调用需要检查。"
      : calls.map((call) => `${call.api}：在 API 库中`).join("\n");
  return {
    id: "code",
    title: "先生成调用代码，再抽出列表",
    summary: "先按原话挑选动作 API，再把引用参数依赖的解析调用补进列表。数值和枚举仍只来自原话。",
    stages: [
      { title: "1. 在动作 API 里挑选", body: retrieval },
      {
        title: "2. 为引用参数补上解析调用",
        body: closed.reasons.length === 0 ? "没有需要补的调用。" : closed.reasons.join("\n"),
      },
      { title: "3. 生成的代码", body: toCode(calls) },
      { title: "4. 对照 API 库做静态检查", body: check },
      {
        title: "5. 按 writes 检查改动冲突",
        body: conflicts.length === 0 ? "选中的步骤没有写同一个字段。" : conflicts.join("\n"),
      },
    ],
    calls,
    text: formatList(calls),
  };
}

function runPreset(text) {
  const slots = extractSlots(text);
  const picked = stepLibrary.filter((step) => step.match(text, slots));
  const hit =
    picked.length === 0
      ? "原话没有命中步骤。"
      : picked
          .map(
            (step) =>
              `${step.id}：${step.summary}\nmapping_status=${step.mappingStatus}\nallowed_flows=${step.allowedFlows.join("、")}`,
          )
          .join("\n\n");
  const decision =
    picked.length === 0
      ? "没有命中的步骤。API 列表为空。"
      : "allowed_flows 和 mapping_status 未补齐前，步骤不能进入 executable 方案。上面命中的步骤两项都还没补，API 列表为空。";
  return {
    id: "preset",
    title: "按预先写好的流程展开",
    summary: "只展开 allowed_flows 已确认、并且 mapping_status 已核对的步骤。这份库里还没有这样的步骤。",
    stages: [
      { title: "1. 原话命中的步骤", body: hit },
      { title: "2. 能否进入 executable 方案", body: decision },
    ],
    calls: [],
    text: formatList([]),
  };
}

function runAll(text) {
  const normalized = text.trim();
  const slots = extractSlots(normalized);
  return {
    slots,
    slotText: describeSlots(slots),
    results: [runPlan(normalized), runCode(normalized), runPreset(normalized)],
    signatures: formatSignatures(),
  };
}

const api = { apiLibrary, stepLibrary, runAll };
globalThis.NL2Task = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
