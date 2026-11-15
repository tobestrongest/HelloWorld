// 模拟的步骤库、API 库，以及三种“自然语言 → API 列表”的过程。
// 这里不调用真实接口，也不调用大模型。匹配规则是写死的，用来把三种方案的差异稳定地演示出来。

export const apiLibrary = [
  {
    id: "search_artist",
    summary: "按名字搜索歌手",
    params: [{ name: "name", type: "string", required: true, fill: "slot", slot: "artist" }],
    returns: [
      { name: "artist_id", type: "string" },
      { name: "name", type: "string" },
    ],
    relevant(text, slots) {
      return Boolean(slots.artist) || /歌手|艺人/.test(text);
    },
    relevantReason: "原话里识别出了歌手，或出现“歌手 / 艺人”",
  },
  {
    id: "get_top_tracks",
    summary: "获取歌手最热门的歌曲",
    params: [
      {
        name: "artist_id",
        type: "string",
        required: true,
        fill: "output",
        from: { api: "search_artist", field: "artist_id" },
      },
      { name: "limit", type: "integer", required: false, fill: "const", value: 10 },
    ],
    returns: [{ name: "track_ids", type: "array" }],
    relevant(text) {
      return /热门|最热/.test(text);
    },
    relevantReason: "原话里出现“热门 / 最热”",
  },
  {
    id: "get_current_user",
    summary: "获取当前登录用户",
    params: [],
    returns: [{ name: "user_id", type: "string" }],
    relevant() {
      return false;
    },
    relevantReason: "原话通常不会直接提到它，只在别的 API 需要 user_id 时被补上",
  },
  {
    id: "create_playlist",
    summary: "创建一个歌单",
    params: [
      {
        name: "user_id",
        type: "string",
        required: true,
        fill: "output",
        from: { api: "get_current_user", field: "user_id" },
      },
      { name: "name", type: "string", required: true, fill: "slot", slot: "playlistName" },
    ],
    returns: [{ name: "playlist_id", type: "string" }],
    relevant(text) {
      return /歌单/.test(text) && /建|创建|新建|做/.test(text);
    },
    relevantReason: "原话里同时出现“歌单”和“建 / 创建 / 新建 / 做”",
  },
  {
    id: "add_tracks",
    summary: "把歌曲加入歌单",
    params: [
      {
        name: "playlist_id",
        type: "string",
        required: true,
        fill: "output",
        from: { api: "create_playlist", field: "playlist_id" },
      },
      {
        name: "track_ids",
        type: "array",
        required: true,
        fill: "output",
        from: { api: "get_top_tracks", field: "track_ids" },
      },
    ],
    returns: [{ name: "added_count", type: "integer" }],
    relevant(text) {
      return /放入|添加|加入/.test(text);
    },
    relevantReason: "原话里出现“放入 / 添加 / 加入”",
  },
  {
    id: "search_album",
    summary: "按名字搜索专辑",
    params: [{ name: "name", type: "string", required: true, fill: "slot", slot: "album" }],
    returns: [{ name: "album_id", type: "string" }],
    relevant(text) {
      return /专辑/.test(text);
    },
    relevantReason: "原话里出现“专辑”",
  },
  {
    id: "get_album_tracks",
    summary: "获取专辑中的歌曲",
    params: [
      {
        name: "album_id",
        type: "string",
        required: true,
        fill: "output",
        from: { api: "search_album", field: "album_id" },
      },
    ],
    returns: [{ name: "track_ids", type: "array" }],
    relevant(text) {
      return /专辑/.test(text);
    },
    relevantReason: "原话里出现“专辑”",
  },
];

export const stepLibrary = [
  {
    id: "find_artist",
    summary: "根据名字查找歌手",
    when: "原话里能识别出歌手名",
    apis: ["search_artist"],
    match(_text, slots) {
      return Boolean(slots.artist);
    },
  },
  {
    id: "collect_top_tracks",
    summary: "获取这位歌手最热门的歌曲",
    when: "原话里出现“热门 / 最热”",
    apis: ["get_top_tracks"],
    match(text) {
      return /热门|最热/.test(text);
    },
  },
  {
    id: "create_named_playlist",
    summary: "创建一个指定名称的歌单",
    when: "原话里同时有“歌单”和“建 / 创建 / 新建 / 做”",
    apis: ["get_current_user", "create_playlist"],
    match(text) {
      return /歌单/.test(text) && /建|创建|新建|做/.test(text);
    },
  },
  {
    id: "fill_playlist",
    summary: "把歌曲加入歌单",
    when: "原话里出现“放入 / 添加 / 加入”",
    apis: ["add_tracks"],
    match(text) {
      return /放入|添加|加入/.test(text);
    },
  },
  {
    id: "find_album",
    summary: "按名字查找专辑",
    when: "原话里出现“专辑”",
    apis: ["search_album"],
    match(text) {
      return /专辑/.test(text);
    },
  },
  {
    id: "collect_album_tracks",
    summary: "取出专辑里的歌曲",
    when: "原话里出现“专辑”",
    apis: ["get_album_tracks"],
    match(text) {
      return /专辑/.test(text);
    },
  },
];

export const workflows = [
  {
    id: "playlist_of_top_tracks",
    summary: "创建歌单，并放入某歌手的热门歌曲",
    inputs: ["artist", "playlistName"],
    steps: ["find_artist", "collect_top_tracks", "create_named_playlist", "fill_playlist"],
    score(text, slots) {
      if (!/歌单/.test(text) || !/热门|最热/.test(text)) return 0;
      let score = 4;
      if (/放入|添加|加入/.test(text)) score += 1;
      if (/建|创建|新建|做/.test(text)) score += 1;
      if (slots.artist) score += 1;
      if (slots.playlistName) score += 1;
      return score;
    },
  },
  {
    id: "lookup_top_tracks",
    summary: "查询某歌手的热门歌曲",
    inputs: ["artist"],
    steps: ["find_artist", "collect_top_tracks"],
    score(text, slots) {
      if (/歌单|专辑/.test(text) || !/热门|最热/.test(text)) return 0;
      return 3 + (slots.artist ? 2 : 0) + (/查|搜|看/.test(text) ? 1 : 0);
    },
  },
  {
    id: "create_empty_playlist",
    summary: "只创建一个空歌单",
    inputs: ["playlistName"],
    steps: ["create_named_playlist"],
    score(text, slots) {
      if (!/歌单/.test(text) || !/建|创建|新建|做/.test(text)) return 0;
      if (/热门|最热|放入|添加|加入|专辑/.test(text)) return 0;
      return 3 + (slots.playlistName ? 2 : 0);
    },
  },
  {
    id: "album_tracks",
    summary: "查询某张专辑里的歌曲",
    inputs: ["album"],
    steps: ["find_album", "collect_album_tracks"],
    score(text, slots) {
      if (!/专辑/.test(text)) return 0;
      return 4 + (slots.album ? 2 : 0);
    },
  },
];

const slotLabels = {
  artist: "歌手",
  playlistName: "歌单名",
  album: "专辑名",
};

export function getApi(id) {
  const api = apiLibrary.find((item) => item.id === id);
  if (!api) throw new Error(`API 库中没有 ${id}`);
  return api;
}

export function getStep(id) {
  const step = stepLibrary.find((item) => item.id === id);
  if (!step) throw new Error(`步骤库中没有 ${id}`);
  return step;
}

export function extractSlots(text) {
  const slots = {};
  const playlist = text.match(/叫\s*[「“"'《]?(.+?)[」”"'》]?\s*的歌单/);
  if (playlist) slots.playlistName = playlist[1].trim();

  const placed = text.match(/放入\s*[「“"'《]?(.+?)[」”"'》]?\s*(?:最热门|的热门|热门)/);
  if (placed) slots.artist = placed[1].trim();
  if (!slots.artist) {
    const withoutQuery = text.replace(/查一下|看一下|查询|查找|看看/g, "");
    const owned = withoutQuery.match(/([A-Za-z][A-Za-z0-9 .'-]*|[\u4e00-\u9fff]{2,8})的(?:最)?热门/);
    if (owned) slots.artist = owned[1].trim();
  }

  const album = text.match(/专辑\s*[「“"'《]?(.+?)[」”"'》]?\s*(?:里|中|的)/);
  if (album) slots.album = album[1].trim();
  return slots;
}

export function describeSlots(slots) {
  const entries = Object.entries(slots);
  if (entries.length === 0) return "没有从原话里识别出歌手、歌单名或专辑名。";
  return entries.map(([key, value]) => `${slotLabels[key]} = ${value}`).join("，");
}

function quote(value) {
  return `"${value}"`;
}

function bindCall(apiId, previous, slots) {
  const api = getApi(apiId);
  const params = api.params.map((param) => {
    if (param.fill === "const") {
      return { name: param.name, value: String(param.value), source: "常量", missing: false };
    }
    if (param.fill === "slot") {
      const value = slots[param.slot];
      if (value) return { name: param.name, value: quote(value), source: "用户输入", missing: false };
      return {
        name: param.name,
        value: "<缺失>",
        source: `用户输入里没有${slotLabels[param.slot]}`,
        missing: true,
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
      value: "<缺失>",
      source: `API 库要求来自 ${param.from.api}.${param.from.field}，列表里没有这次调用`,
      missing: true,
    };
  });
  return { api: api.id, summary: api.summary, params };
}

function expandSteps(steps, slots) {
  const calls = [];
  for (const step of steps) {
    for (const apiId of step.apis) calls.push(bindCall(apiId, calls, slots));
  }
  return calls;
}

export function formatCall(call, index) {
  const args = call.params.map((param) => `${param.name}=${param.value}`).join(", ");
  return `${index}. ${call.api}(${args})`;
}

export function formatList(calls) {
  if (calls.length === 0) return "（空列表）";
  return calls.map((call, index) => formatCall(call, index + 1)).join("\n");
}

function formatSignatures() {
  return apiLibrary
    .map((api) => {
      const args = api.params
        .map((param) => `${param.name}: ${param.type}${param.required ? "" : "?"}`)
        .join(", ");
      const returns = api.returns.map((item) => item.name).join(", ");
      return `${api.id}(${args}) -> ${returns}    ${api.summary}`;
    })
    .join("\n");
}

function closeProducers(selectedIds) {
  const selected = new Set(selectedIds);
  const reasons = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...selected]) {
      for (const param of getApi(id).params) {
        if (param.required && param.fill === "output" && !selected.has(param.from.api)) {
          selected.add(param.from.api);
          reasons.push(
            `${id} 的参数 ${param.name} 需要 ${param.from.api}.${param.from.field}，因此在代码里补上 ${param.from.api}`,
          );
          changed = true;
        }
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
    .sort((a, b) => apiLibrary.findIndex((api) => api.id === a) - apiLibrary.findIndex((api) => api.id === b));
  const ordered = [];
  while (ready.length > 0) {
    const id = ready.shift();
    ordered.push(id);
    for (const child of next.get(id)) {
      incoming.set(child, incoming.get(child) - 1);
      if (incoming.get(child) === 0) {
        ready.push(child);
        ready.sort(
          (a, b) => apiLibrary.findIndex((api) => api.id === a) - apiLibrary.findIndex((api) => api.id === b),
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
  if (param.value === "<缺失>") return '"<缺失>"';
  const match = param.value.match(/^\$(\d+)\.(.+)$/);
  if (!match) return param.value;
  return `step${match[1]}.${match[2]}`;
}

export function runPlan(text) {
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
  return {
    id: "plan",
    title: "先规划列表，再展开",
    summary: "先选出步骤，再按步骤库展开成 API。没有被选中的步骤不会自动补上。",
    stages: [
      { title: "1. 规划出的步骤列表", body: taskLines },
      { title: "2. 用步骤库展开成 API", body: expansion },
      { title: "3. 按 API 库填写参数", body: formatList(calls) },
    ],
    calls,
    text: formatList(calls),
  };
}

export function runCode(text) {
  const slots = extractSlots(text);
  const judged = apiLibrary.map((api) => ({
    api,
    hit: api.relevant(text, slots),
  }));
  const initial = judged.filter((item) => item.hit).map((item) => item.api.id);
  const closed = closeProducers(initial);
  const calls = [];
  for (const id of closed.ids) calls.push(bindCall(id, calls, slots));
  const retrieval = judged
    .map((item) => `${item.hit ? "选用" : "跳过"}  ${item.api.id}    ${item.api.relevantReason}`)
    .join("\n");
  const check =
    calls.length === 0
      ? "没有调用需要检查。"
      : calls
          .map((call) => `${call.api}：在 API 库中`)
          .join("\n");
  return {
    id: "code",
    title: "先生成调用代码，再抽出列表",
    summary: "先按原话挑选 API，再根据参数来源把缺的上游调用补进代码。静态检查只确认函数名存在。",
    stages: [
      { title: "1. 在 API 库里挑选相关函数", body: retrieval },
      {
        title: "2. 为缺少的参数补上上游调用",
        body: closed.reasons.length === 0 ? "没有需要补的调用。" : closed.reasons.join("\n"),
      },
      { title: "3. 生成的代码", body: toCode(calls) },
      { title: "4. 对照 API 库做静态检查", body: check },
    ],
    calls,
    text: formatList(calls),
  };
}

export function runPreset(text) {
  const slots = extractSlots(text);
  const ranked = workflows
    .map((workflow) => ({ workflow, score: workflow.score(text, slots) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const scoreLines = ranked.map((item) => `${item.score} 分    ${item.workflow.id}：${item.workflow.summary}`).join("\n");
  if (!best || best.score < 3) {
    return {
      id: "preset",
      title: "按预先写好的流程展开",
      summary: "只在预定义流程里选择。选不中时列表为空，不会现编步骤。",
      stages: [
        { title: "1. 给每个预定义流程打分", body: scoreLines },
        { title: "2. 选择结果", body: "没有得分达到 3 的流程。" },
      ],
      calls: [],
      text: formatList([]),
    };
  }
  const workflow = best.workflow;
  const steps = workflow.steps.map(getStep);
  const calls = expandSteps(steps, slots);
  const missingInputs = workflow.inputs.filter((name) => !slots[name]);
  const inputLines = workflow.inputs
    .map((name) => (slots[name] ? `${slotLabels[name]} = ${slots[name]}` : `${slotLabels[name]} = <缺失>`))
    .join("\n");
  return {
    id: "preset",
    title: "按预先写好的流程展开",
    summary: "选中一条写好的流程后，只展开这条流程里的步骤。",
    stages: [
      { title: "1. 给每个预定义流程打分", body: scoreLines },
      {
        title: "2. 选中的流程",
        body: `${workflow.id}：${workflow.summary}\n步骤：${workflow.steps.join(" → ")}`,
      },
      {
        title: "3. 填写流程输入",
        body: missingInputs.length === 0 ? inputLines : `${inputLines}\n缺少的输入不会另找一个 API 去补。`,
      },
    ],
    calls,
    text: formatList(calls),
  };
}

export function runAll(text) {
  const normalized = text.trim();
  return {
    slots: extractSlots(normalized),
    slotText: describeSlots(extractSlots(normalized)),
    results: [runPlan(normalized), runCode(normalized), runPreset(normalized)],
    signatures: formatSignatures(),
  };
}
