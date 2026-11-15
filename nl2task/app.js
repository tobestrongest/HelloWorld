const bench = globalThis.NL2Task;

const examples = [
  "建一个叫 Love Coldplay 的歌单，放入 Coldplay 最热门的歌",
  "查一下周杰伦的热门歌曲",
  "建一个叫通勤的歌单",
  "放入 Coldplay 最热门的歌",
  "看一下专辑 Abbey Road 里的歌",
  "今天天气怎么样",
];

const input = document.querySelector("#nl");
const steps = document.querySelector("#steps");
const apis = document.querySelector("#apis");
const exampleBox = document.querySelector("#examples");
const slots = document.querySelector("#slots");
const results = document.querySelector("#results");

for (const step of bench.stepLibrary) {
  const item = document.createElement("li");
  const title = document.createElement("code");
  title.textContent = step.id;
  const summary = document.createElement("div");
  summary.textContent = `${step.summary}。${step.when}。`;
  const apisUsed = document.createElement("div");
  apisUsed.className = "sig";
  apisUsed.textContent = step.apis.join(" → ");
  item.append(title, summary, apisUsed);
  steps.append(item);
}

for (const api of bench.apiLibrary) {
  const item = document.createElement("li");
  const title = document.createElement("code");
  const args = api.params.map((param) => `${param.name}: ${param.type}${param.required ? "" : "?"}`).join(", ");
  title.textContent = `${api.id}(${args})`;
  const summary = document.createElement("div");
  summary.textContent = api.summary;
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
    render();
  });
  exampleBox.append(button);
}

document.querySelector("#run").addEventListener("click", render);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) render();
});

function render() {
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
}

render();
