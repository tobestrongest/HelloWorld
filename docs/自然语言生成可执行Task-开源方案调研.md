# 自然语言生成可执行 Task：开源方案调研

调研日期 2026 年 11 月 13 日。star 数和更新时间取自 GitHub 当日数据。

## 结论

开源社区没有和我们“步骤库 + API 库”设计完全一致、可以直接采用的框架，但我们要做的每个环节都有公开实现可以借鉴。

现有做法可归为四条路线，区别主要在两点：模型产出的是结构化计划还是代码，计划是一次生成还是边执行边生成。

和我们设计最接近的 RestGPT、HuggingGPT、LLMCompiler 是已停更的论文代码，TaskWeaver 已归档。它们适合借鉴设计，不适合直接依赖。

本次覆盖 9 个开源项目、4 条实现路线。其中 RestGPT、HuggingGPT、LLMCompiler、TaskWeaver、Voyager 阅读了源码。

## 一、背景

我们的目标是把自然语言请求转换成可执行的 Task，依靠两个映射库：步骤库定义某种操作需要用到哪些 API，API 库定义每个 API 的具体签名。

本次调研要回答三个问题：开源社区有没有类似的框架，它们是怎么实现的，各有什么优缺点。

## 二、四条路线总览

| 路线 | 代表项目 | 模型产出什么 | 主要优点 | 主要问题 |
| --- | --- | --- | --- | --- |
| 一、走一步看一步 | RestGPT | 每次只产出下一步，拿到接口结果后再定后续 | 能利用中间结果；接口文档按需加载 | 不产出完整 Task；模型调用多 |
| 二、一次生成结构化计划 | HuggingGPT、LLMCompiler | 带依赖关系的任务列表 | 产物可保存、可审查；执行由程序完成 | 表达不了分支和循环；中途调整能力弱 |
| 三、生成代码 | TaskWeaver、Voyager | 调用 API 函数的代码 | 表达力最强，能写循环、分支和数据处理 | 需要沙箱；结果不稳定；审计困难 |
| 四、预先写好流程 | Arazzo、Agent SOP / Agent Skills | 模型不产出计划，流程事先写好 | 流程可控；步骤库容易维护 | Arazzo 不处理自然语言；SOP 类每次靠模型现场执行 |

## 三、各路线的实现过程与优缺点

### 路线一：走一步看一步，每步分两层决定

模型不事先写出完整计划。它每次只决定下一步做什么，调用接口拿到结果后，再决定后面怎么走。代表项目是 RestGPT。

#### [RestGPT](https://github.com/Yifan-Song793/RestGPT)

约 1.4k star，MIT，论文代码，2024 年 6 月后未更新。

让模型通过 OpenAPI 规范操作真实的 REST 接口，论文用 TMDB 电影库和 Spotify 两个场景做实验。

**为什么不事先写完整计划。** 后面步骤要用的参数，往往要等前面的接口返回才知道。比如要往歌单里加歌，得先查到歌手 ID、歌曲 ID 和歌单 ID，这些值在动手之前都不存在。

**“分两层”是什么意思。** 每一步由两个角色先后决定。Planner 只说“要做什么”，不看接口文档；API Selector 手里有接口清单，负责决定“用哪个接口做”。类似项目经理提需求，熟悉接口的工程师挑接口。

**一个完整的例子。** 用户请求：建一个叫 Love Coldplay 的歌单，放入 Coldplay 最热门的歌。

| 轮次 | Planner：下一步做什么 | API Selector：选哪个接口 | 接口返回了什么 |
| --- | --- | --- | --- |
| 1 | 查 Coldplay 最热门的歌 | GET /search | Coldplay 的歌手 ID |
| 2 | 继续查 Coldplay 最热门的歌（带上歌手 ID） | GET /artists/{id}/top-tracks | Yellow、Viva La Vida 及其歌曲 ID |
| 3 | 建一个叫 Love Coldplay 的歌单 | GET /me | 当前用户的 ID |
| 4 | 继续建歌单（带上用户 ID） | POST /users/{user_id}/playlists | 新歌单的 ID |
| 5 | 把这两首歌加进歌单（带上歌曲 ID 和歌单 ID） | POST /playlists/{id}/tracks | 添加成功 |

用户只说了一句话，实际调用了 5 个接口。第 1 轮查歌时，Planner 并不知道要先查歌手 ID；第 3 轮建歌单时，也不知道要先拿用户 ID。这些都是 API Selector 看了接口清单才发现的，Planner 看到返回结果后，下一轮就说“继续”，把同一件事做完。

例子取自 RestGPT 提示词中的 Spotify 示例，步骤原文为英文，这里译成中文。

**每一轮内部的实现过程**

1. **规划（Planner）。** 根据用户请求和已有的执行结果，用自然语言写出下一步要做什么。
2. **选接口（API Selector）。** 读取全部接口的名称和一句话简介，把这一步映射成具体的接口调用。选了清单外的接口会被要求重选。
3. **调用（Caller）。** 只读取被选中接口的完整文档，填好参数并发起请求。
4. **解析（Parser）。** 让模型按响应结构写一段 Python 代码，从返回数据里取出需要的内容。
5. **回到规划。** 结果交还 Planner，由它决定继续、补一步还是结束，最多循环 15 轮。

**与我们两库的对应。** Planner 写出的自然语言步骤相当于我们的步骤这一层，但它没有预先定义的步骤库，步骤是模型现想的，靠提示词里的几条示例引导。API Selector 做的是步骤到 API 的映射。API 库对应 OpenAPI 规范文件，Caller 按它填参数。

**优点**

- 两级映射与我们的设计一致：先定步骤，再把步骤映射到接口。
- 接口文档按需加载：选接口时只看名称和简介，调用时才读完整文档。
- 能利用中间结果，例如先查到 ID，再用 ID 查详情。
- 直接读取 OpenAPI 规范，接入新接口不用写适配代码。

**缺点**

- 不产出完整的 Task：计划和执行交织在一起，无法事先审查，也无法保存复用。
- 模型调用多：每一步要经过规划、选接口、调用、解析，约 4 次调用，慢且成本高。
- 没有步骤库：步骤由模型凭常识现想，换一个业务场景要重写提示词示例。
- 选接口时把全部接口名称放进提示词，没有检索，接口多了放不下。
- 基于旧版 LangChain 的论文代码，已停止更新。

### 路线二：一次生成结构化计划，再由程序执行

模型一次输出完整的任务列表，写明每个任务的依赖，之后由确定性的调度程序执行。代表项目是 HuggingGPT 和 LLMCompiler。

#### [HuggingGPT（JARVIS）](https://github.com/microsoft/JARVIS)

约 2.6 万 star，MIT，微软研究项目，2025 年 7 月后未更新。

用大模型调度 Hugging Face 上的各类 AI 模型，完成图像、语音、文本混合的任务。

**实现过程**

1. **任务规划。** 模型把请求解析成 JSON 任务列表。每个任务的类型必须从固定清单里选，并写明依赖哪些上游任务。
2. **模型选择。** 对每个任务，程序按任务类型筛出候选模型，再让大模型根据模型描述选一个。
3. **任务执行。** 程序按依赖关系调度，上游任务的产物自动填进下游任务的参数。
4. **汇总回复。** 模型根据全部执行结果生成给用户的回答。

**与我们两库的对应。** 步骤库对应固定的任务类型清单；API 库对应每种任务类型下的候选模型及其描述。先定步骤类型、再选具体实现，这一点和我们一致。

**任务规划的输出（取自项目自带示例，节选）**

```text
请求: Give you some pictures e1.jpg, e2.png, e3.jpg, help me count the number of sheep?

[
  {"task": "image-to-text", "id": 0, "dep": [-1],
   "args": {"image": "e1.jpg"}},
  {"task": "object-detection", "id": 1, "dep": [-1],
   "args": {"image": "e1.jpg"}},
  {"task": "visual-question-answering", "id": 2, "dep": [1],
   "args": {"image": "<GENERATED>-1", "text": "How many sheep in the picture"}},
  ...
]
```

**优点**

- 产物是结构化的任务列表，可以保存、审查、重放。
- 步骤类型受清单约束，模型不会编造不存在的步骤。
- 依赖关系显式写出，执行逻辑简单。

**缺点**

- 计划一次定死，执行出错或结果不符预期时不会重新规划。
- 参数只支持文本、图片、音频三种，表达不了复杂的接口签名。
- 不支持条件分支和循环。
- 计划质量依赖提示词里的示例。
- 面向调度 AI 模型的场景，代码不能直接复用。

#### [LLMCompiler](https://github.com/SqueezeAILab/LLMCompiler)

约 1.9k star，MIT，ICML 2024 论文代码，2024 年 7 月后未更新。

把规划当成编译：模型写出函数调用序列，程序分析依赖后并行执行。

**实现过程**

1. **规划。** 模型输出带编号的函数调用列表，参数里用 `$1`、`$2` 引用前面任务的结果。
2. **解析依赖。** 程序从这些引用推导出依赖关系，组成有向无环图。
3. **并行调度。** 依赖已满足的任务立即并发执行，执行前把引用替换成实际结果。
4. **汇总与重新规划。** 模型判断结果是否足够回答。不够就带着已有结果重新规划，次数有上限。

**与我们两库的对应。** 没有步骤库；API 库对应写进提示词的工具描述。

**计划格式（取自项目提示词中的示例）**

```text
Question: With the Sahara Desert's area reduced by 33% and the Kalahari
Desert's area magnified by 52%, which one covers more ground?

1. search('Sahara Desert')
2. math('Sahara Desert area in km^2 if reduced by 33%?', ['$1'])
3. search("Kalahari Desert")
4. math('Kalahari Desert area in km^2 if magnified by 52%?', ['$3'])
5. join()
```

**优点**

- 计划格式极简，就是函数调用列表，容易解析和校验。
- 互不依赖的步骤并行执行，耗时短。
- 每轮只需规划和汇总两次模型调用。
- 有重新规划机制，弥补一次性计划的不足。

**缺点**

- 没有步骤库，也没有检索，所有工具描述都要放进提示词。
- 上游结果以整段文本替换进下游参数，不能只取其中某个字段。
- 不支持条件分支和循环。
- 论文代码，已停止更新。

### 路线三：让模型直接写代码

把 API 库包装成函数，模型生成调用这些函数的代码，放进沙箱执行。代表项目是 TaskWeaver 和 Voyager。

#### [TaskWeaver](https://github.com/microsoft/TaskWeaver)

约 6.2k star，MIT，微软，2026 年 3 月已归档。

代码优先的 agent 框架，主要面向数据分析任务。

**实现过程**

1. **规划。** Planner 把请求拆成步骤，标注步骤间的依赖类型，并把能一次完成的步骤合并。
2. **选插件（可选）。** 按请求与插件描述的向量相似度，只挑最相关的几个插件放进提示词。
3. **生成代码。** 代码生成器根据当前步骤，写出调用插件的 Python 代码。
4. **静态校验。** 解析代码的语法树，检查是否只调用了允许的函数和模块，不通过则退回重写。
5. **执行。** 在保留变量状态的 Python 内核里运行，结果交还 Planner 检查并决定下一步。
6. **经验沉淀（可选）。** 把成功的对话保存下来，由模型总结成经验，下次遇到相似请求时检索出来放进提示词。

**与我们两库的对应。** 步骤库对应 Planner 的计划加上可检索的经验库；API 库对应插件 YAML，包含名称、描述、参数、返回值和调用示例。

**插件定义（项目自带的 `sql_pull_data.yaml`，节选）**

```yaml
name: sql_pull_data
description: >-
  Pull data from a SQL database.
  This plugin takes user requests when obtaining data from database is explicitly mentioned.
examples: |-
  df, description = sql_pull_data("pull data from time_series table")

parameters:
  - name: query
    type: str
    required: true
    description: >-
      This is the query in natural language that the user wants to get data from database.

returns:
  - name: df
    type: pandas.DataFrame
    description: This is the dataframe containing the data from the database.
  - name: description
    type: str
    description: This is a string describing the data pulled from the database.
```

**优点**

- API 库的定义格式完整，可以直接参考。
- 代码能表达循环、分支和数据加工，表达力最强。
- 有生成后的静态校验，能拦住调用清单外函数的代码。
- 有经验沉淀机制，相当于步骤库可以逐步积累。
- 本次调研的项目里工程化程度最高，文档齐全。

**缺点**

- 产物是代码，必须在沙箱里执行，安全和审计成本高。
- 同一请求每次生成的代码可能不同，结果不稳定。
- Planner 与代码生成器多轮往返，模型调用多。
- 仓库已归档，不再维护。
- 围绕 Python 数据分析设计，移植到其他场景改动大。

#### [Voyager](https://github.com/MineDojo/Voyager)

约 7.3k star，MIT，论文代码，2024 年 4 月后未更新。

在《我的世界》游戏里持续学习新技能的 agent，核心贡献是一个会自动增长的技能库。

**实现过程**

1. **检索技能。** 用任务描述在技能库里做向量检索，取最相似的 5 个技能。
2. **生成代码。** 把这些技能的代码和基础 API 的用法放进提示词，模型写出完成任务的新函数，并被要求优先复用已有技能。
3. **执行。** 在游戏环境中运行生成的函数。
4. **验证。** 另一个模型根据执行后的状态判断任务是否完成。没完成就把报错和改进意见反馈回去重写，最多 4 次。
5. **入库。** 成功的函数由模型生成一段文字描述，代码和描述一起存入技能库，描述用于以后检索。

**与我们两库的对应。** 步骤库对应技能库，每个技能是一段调用基础 API 或其他技能的代码；API 库对应十来个基础控制函数及其用法说明。

**优点**

- 步骤库自动增长，技能可以调用技能，能力逐步叠加。
- 步骤检索方案简单：给每个步骤配一段描述，对描述做向量检索。
- 有执行后的验证和重试闭环。
- 提示词明确要求用高层函数而不是底层 API，约束了模型的发挥空间。

**缺点**

- 自动入库没有人工把关，库里会出现功能重复的技能。项目自带的技能库里就有多个带 V2 后缀的同名技能。
- 依赖能自动判断成败的环境，业务场景里是否做对了往往难以自动判断。
- 只靠相似度检索，技能多了以后容易取错。
- 多轮重试成本高。
- 游戏场景的论文代码，已停止更新。

### 路线四：预先写好流程，运行时照着执行

步骤库本身就是产物：人或离线工具事先把流程写成文档，运行时由执行器或 agent 按文档走。代表是 Arazzo 和 Agent SOP / Agent Skills。

#### [Arazzo 规范与 arazzo-engine](https://github.com/OAI/Arazzo-Specification)

规范约 490 star，仍在更新。arazzo-engine 约 70 star，2026 年 6 月后未更新。Apache-2.0。

OpenAPI 组织发布的官方规范，用 YAML 描述跨一个或多个 API 的多步调用流程。arazzo-engine 是配套的开源执行器和生成器。

**实现过程**

1. **引用 API 库。** 流程文件声明它用到哪些 OpenAPI 规范文件。
2. **定义流程。** 每个流程写明输入、步骤和输出，每个步骤指向一个具体的接口操作。
3. **步骤间传值。** 参数用表达式取值，可以来自流程输入，也可以来自前面步骤的输出。
4. **成功判定与失败处理。** 每步写明成功条件。失败时可配置重试、跳转或结束。
5. **执行（Runner）。** 按文件确定性执行，过程中不调用大模型。
6. **生成（Generator）。** 用大模型分析 OpenAPI 规范，自动找出有意义的接口调用序列，生成流程文件。

**与我们两库的对应。** 步骤库对应 Arazzo 流程文件；API 库对应 OpenAPI 规范。步骤引用接口、接口定义签名，两库的关系和我们的设计几乎一样。

**流程文件（官方示例 LoginAndRetrievePets，节选）**

```yaml
sourceDescriptions:
- name: petStoreDescription
  url: https://raw.githubusercontent.com/swagger-api/swagger-petstore/master/src/main/resources/openapi.yaml
  type: openapi

workflows:
- workflowId: loginUserRetrievePet
  summary: Login User and then retrieve pets
  inputs:
      type: object
      properties:
          username:
              type: string
          password:
              type: string
  steps:
  - stepId: loginStep
    operationId: $sourceDescriptions.petStoreDescription.loginUser
    parameters:
      - name: username
        in: query
        value: $inputs.username
      - name: password
        in: query
        value: $inputs.password
    successCriteria:
      - condition: $statusCode == 200
    outputs:
      sessionToken: $response.body
  - stepId: getPetStep
    operationPath: '{$sourceDescriptions.petStoreDescription.url}#/paths/~1pet~1findByStatus'
    parameters:
      - name: status
        in: query
        value: 'available'
      - name: Authorization
        in: header
        value: $steps.loginStep.outputs.sessionToken
    successCriteria:
      - condition: $statusCode == 200
    outputs:
      availablePets: $response.body
  outputs:
      available: $steps.getPetStep.outputs.availablePets
```

**优点**

- 行业标准，格式设计成熟：输入、输出、步骤间引用、成功条件、失败处理都有定义。
- 执行完全确定，可审计、可重复，执行时没有模型成本。
- 与 OpenAPI 天然衔接，与编程语言无关。
- 可以直接作为我们步骤库或 Task 数据格式的参考。

**缺点**

- 不处理自然语言：选哪个流程、填什么参数，仍要自己做。
- Generator 做的是从 API 库生成步骤库，不是从用户请求生成 Task。
- 只面向 HTTP 接口。如果我们的 API 是函数或 SDK，需要改造。
- 配套工具还在早期，Generator 标注为 Beta。

#### [Agent SOP 与 Agent Skills](https://github.com/strands-agents/agent-sop)

agent-sop 约 1.2k star，Apache-2.0。anthropics/skills 约 19 万 star。两者都在持续更新。

两个相近的开放格式：用 Markdown 写分步流程，agent 运行时读取并自行调用工具完成。Agent SOP 来自 AWS，Agent Skills 来自 Anthropic。

**实现过程**

1. **编写流程。** 用 Markdown 写明概述、参数和步骤。Agent SOP 给每一步加上 MUST、SHOULD、MAY 三级约束。
2. **发现。** Agent Skills 启动时只加载每个技能的名称和描述，每个约 100 token。
3. **加载。** 请求命中某个技能后才读入全文，附带的脚本和参考资料用到时再读。
4. **执行。** agent 按步骤自行决定调用哪些工具。也有变体每次只下发一个步骤，要求提交产出后才给下一步。

**与我们两库的对应。** 步骤库对应 SOP 或技能文档；API 库对应 agent 可用的工具。步骤与 API 的对应关系写在自然语言里，没有结构化的映射。

**Agent SOP 的文档结构（官方格式规范）**

```markdown
# [SOP Name]

## Overview
[这个 SOP 做什么、什么时候用]

## Parameters
- **required_param** (required): [说明]
- **optional_with_default** (optional, default: "default_value"): [说明]

## Steps

### 1. [Step Name]
[用自然语言描述这一步做什么]

**Constraints:**
- You MUST [必须做到的要求]
- You SHOULD [建议的做法]
- You MAY [可选的做法]

### 2. [Next Step]
...
```

**优点**

- 编写门槛最低，业务人员就能维护步骤库。
- 分级加载解决了步骤库变大后放不进提示词的问题。
- 灵活，能应对流程里没写到的情况。
- 有公开的格式规范，社区活跃。

**缺点**

- 不产出静态的可执行 Task，每次都靠模型现场理解和执行，结果不完全可重复。
- 步骤和 API 的对应关系是隐式的，无法事先校验。
- 效果高度依赖模型能力。
- 每次执行都有模型推理成本。

### 补充：API 数量很大时怎么选

[ToolBench](https://github.com/OpenBMB/ToolBench)（约 5.8k star，Apache-2.0，2025 年 5 月后未更新）收集了 16464 个真实 REST 接口。它训练了专门的检索模型，先从全部接口里取出最相关的几个，再用带回退的深度优先搜索尝试多条调用路径。

优点是大规模接口检索有现成的方案和数据。缺点是检索模型需要训练数据，搜索过程模型调用多，而且没有步骤这一层。

## 四、横向对比

| 项目 | 产物能否事先审查 | 能否中途调整 | 分支和循环 | 模型调用量 | 步骤库 | 维护状态 |
| --- | --- | --- | --- | --- | --- | --- |
| RestGPT | 否，边生成边执行 | 能，每步都看结果 | 不支持 | 高，每步约 4 次 | 无，靠提示词示例 | 2024 年 6 月停更 |
| HuggingGPT | 能，JSON 任务列表 | 不能 | 不支持 | 中，规划 1 次加每任务 1 次 | 固定任务类型清单 | 2025 年 7 月后未更新 |
| LLMCompiler | 能，函数调用列表 | 能，整体重新规划 | 不支持 | 低，每轮 2 次 | 无 | 2024 年 7 月停更 |
| TaskWeaver | 部分，代码逐步生成 | 能 | 支持 | 高，多轮往返 | 经验库，可选 | 2026 年 3 月归档 |
| Voyager | 能，函数代码入库 | 能，失败后重写 | 支持 | 高，最多重试 4 次 | 技能库，自动增长 | 2024 年 4 月停更 |
| Arazzo | 能，标准 YAML | 仅按预设的失败处理 | 部分，成功或失败后跳转 | 执行时为零 | 流程文件本身 | 规范仍在更新 |
| Agent SOP / Skills | 流程文档能，实际调用不能 | 能 | 用自然语言描述 | 高，全程由模型执行 | 文档本身 | 持续更新 |

## 五、对我们的启示（初步建议，供讨论）

建议自研核心流程，不基于上述任何一个框架二次开发，但逐个环节借鉴它们的做法：

| 环节 | 借鉴对象 | 借鉴什么 |
| --- | --- | --- |
| 步骤库的格式 | Arazzo | 输入、步骤、步骤间引用、成功条件、输出的定义方式 |
| API 库的格式 | TaskWeaver 插件 YAML、OpenAPI | 描述、参数、返回值、调用示例 |
| 步骤检索 | Voyager、Agent Skills | 对步骤描述做向量检索；先只加载名称和描述，命中后再加载全文 |
| 步骤到 API 的映射 | RestGPT | 两级映射；只加载被选中接口的完整文档 |
| Task 的格式 | HuggingGPT、LLMCompiler | 带编号、依赖和上游结果引用的任务列表 |
| 校验与重试 | RestGPT、TaskWeaver | 对照 API 库检查生成结果，失败时带着错误信息重试 |
| 执行 | LLMCompiler | 按依赖关系并行调度 |
| 步骤库的积累 | Voyager、TaskWeaver | 把成功案例沉淀为新步骤，入库前需要人工审核 |

### 需要先定下来的三个问题

1. **Task 的形态。** 结构化任务列表容易校验和审计，但表达不了复杂逻辑。代码表达力强，但需要沙箱，审计成本高。
2. **规划的时机。** 一次生成完整 Task 可以事先审查。边执行边规划能利用中间结果。折中做法是一次生成，失败后重新规划。
3. **步骤库怎么维护。** 人工编写质量可控，但成本高。从成功案例自动沉淀成本低，但需要审核机制防止库里混入重复或错误的步骤。

## 说明

调研方法：RestGPT、HuggingGPT、LLMCompiler、TaskWeaver、Voyager 阅读了源码和提示词；Arazzo、arazzo-engine、Agent SOP、Agent Skills、ToolBench 依据官方规范、文档、示例和部分源码。

各项目的优缺点是结合我们的目标做出的判断，不是项目方的自我评价。第五部分是初步建议，尚未经过原型验证。
