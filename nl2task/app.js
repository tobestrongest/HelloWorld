const bootError = document.querySelector("#boot-error");
const bench = globalThis.NL2Task;
if (!bench) {
  bootError.hidden = false;
  throw new Error("engine.js 没有加载");
}
bootError.hidden = true;

const examples = [
  "在曲线 IdVg 上新建 Region R1，范围 0 到 1，权重 2",
  "把 Region R1 的权重改成 0.5",
  "把优化器换成 L-BFGS，迭代 40 次",
  "跑一轮 PS，目标是线性",
  "删掉器件 D1 在 25 度的异常数据",
  "今天天气怎么样",
];

const input = document.querySelector("#nl");
const steps = document.querySelector("#steps");
const apis = document.querySelector("#apis");
const exampleBox = document.querySelector("#examples");
const slots = document.querySelector("#slots");
const results = document.querySelector("#results");

document.querySelector("#steps-heading").textContent = `步骤库（${bench.stepLibrary.length}）`;
document.querySelector("#apis-heading").textContent = `API 库（${bench.apiLibrary.length}）`;

for (const step of bench.stepLibrary) {
  const item = document.createElement("li");
  const title = document.createElement("code");
  title.textContent = step.id;
  const summary = document.createElement("div");
  summary.textContent = `${step.summary}。${step.when}。mapping_status=${step.mappingStatus}，allowed_flows=${step.allowedFlows.join("、")}。`;
  const apisUsed = document.createElement("div");
  apisUsed.className = "sig";
  const writes = step.writes.map((write) => `${write.object}.${write.field}`).join(", ");
  apisUsed.textContent = `${step.apis.join(" → ")}\n写入 ${writes}`;
  item.append(title, summary, apisUsed);
  steps.append(item);
}

for (const api of bench.apiLibrary) {
  const item = document.createElement("li");
  const title = document.createElement("code");
  const args = api.params
    .map((param) => {
      const type = param.values.length ? `enum[${param.values.join("|")}]` : param.type;
      return `${param.name}: ${type}${param.required ? "" : "?"}`;
    })
    .join(", ");
  title.textContent = `${api.id}(${args})`;
  const summary = document.createElement("div");
  const flags = [api.kind === "resolve" ? "解析" : "动作"];
  if (api.destructive) flags.push("destructive");
  if (api.confirmRequired) flags.push("confirm_required");
  summary.textContent = `${flags.join(" · ")}。${api.summary}`;
  const origin = document.createElement("div");
  origin.className = "sig";
  origin.textContent =
    api.params.length === 0
      ? "无参数"
      : api.params
          .map((param) => {
            if (param.fill === "slot") return `${param.name} ← 用户输入`;
            if (param.fill === "const") return `${param.name} ← 常量 ${param.value}`;
            return `${param.name} ← ${param.from.api}.${param.from.field}`;
          })
          .join("\n");
  item.append(title, summary, origin);
  apis.append(item);
}

for (const example of examples) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = example;
  button.addEventListener("click", () => {
    input.value = example;
    render({ scroll: true });
  });
  exampleBox.append(button);
}

document.querySelector("#run").addEventListener("click", () => render({ scroll: true }));
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) render();
});

function render(options = {}) {
  const outcome = bench.runAll(input.value);
  slots.hidden = false;
  slots.replaceChildren();
  const label = document.createElement("strong");
  label.textContent = "从原话识别出";
  slots.append(label, document.createTextNode(outcome.slotText));

  results.replaceChildren();
  for (const result of outcome.results) {
    const card = document.createElement("article");
    card.className = "result";
    const header = document.createElement("header");
    const heading = document.createElement("h2");
    heading.textContent = result.title;
    const summary = document.createElement("p");
    summary.textContent = result.summary;
    header.append(heading, summary);
    card.append(header);

    for (const stage of result.stages) {
      const block = document.createElement("section");
      block.className = "stage";
      const title = document.createElement("h3");
      title.textContent = stage.title;
      const body = document.createElement("pre");
      body.textContent = stage.body;
      block.append(title, body);
      card.append(block);
    }

    const table = document.createElement("table");
    table.className = "calls";
    const head = document.createElement("tr");
    for (const name of ["#", "API", "参数"]) {
      const cell = document.createElement("th");
      cell.textContent = name;
      head.append(cell);
    }
    table.append(head);
    if (result.calls.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 3;
      cell.textContent = "没有生成 API。";
      row.append(cell);
      table.append(row);
    }
    result.calls.forEach((call, index) => {
      const row = document.createElement("tr");
      const order = document.createElement("td");
      order.textContent = String(index + 1);
      const name = document.createElement("td");
      name.textContent = call.api;
      const args = document.createElement("td");
      if (call.params.length === 0) args.textContent = "无参数";
      if (call.confirmRequired) {
        const note = document.createElement("div");
        note.className = "missing";
        note.textContent = "destructive，需要确认。这一步只留在列表里。";
        args.append(note);
      }
      call.params.forEach((param) => {
        const line = document.createElement("div");
        line.textContent = `${param.name}=${param.value} · ${param.source}`;
        if (param.missing) line.className = "missing";
        args.append(line);
      });
      row.append(order, name, args);
      table.append(row);
    });
    card.append(table);
    results.append(card);
  }
  if (options.scroll) results.scrollIntoView({ behavior: "smooth", block: "start" });
}

render();
