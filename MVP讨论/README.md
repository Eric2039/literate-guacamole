# ZIXEL SEO 内容工厂 — Spec 导航

> 这个 README 是给**任何新 Claude 窗口**的入口。读这一份, 知道仓库结构 + 两条 branch 的差异 + 启动新窗口的标准句。

---

## 项目一句话

ZIXEL SEO 内容工厂 — 关键词(和热点事件) → 流水线 → 一篇可发布的中文 SEO 文章, 推送到飞书。目标: 高量、差异化、抗 AI 检测、抗 Google helpful content update。

## 项目核心: 文章质量迭代 (读这段再选 branch)

**当前阶段的重心是把文章质量做好**, 不是搭工程化系统。用户原话: "我们这个要做的是围绕 MVP 进行迭代升级"。

这意味着:

- **MVP 不是一次性验证脚手架** — 它是质量迭代的起点和载体。整个项目当前 = 反复跑 MVP → review → 调 prompt/约束/字数表/§9 → 再跑, 直到文章质量稳定到可用。
- **三阶段路径, 都是必经**: 阶段 1 = MVP script (现在), 阶段 2 = 聚类 script (post-MVP, 让相近关键词产出差异化文章), 阶段 3 = 工程化 (Feishu / 自动 QC / 完整 humanizer / admin UI, 必做不可选)。
- **branch-mvp 覆盖阶段 1 + 2** (都是脚本, `mvp/` 文件持续迭代不丢弃), **branch-original 覆盖阶段 3**。

**所以**: 文章质量还没稳定 → 走 branch-mvp (从阶段 1 MVP 起步)。MVP 稳定 → 仍在 branch-mvp (进入阶段 2 聚类)。聚类稳定 → 转 branch-original (阶段 3 工程化, 必经, 不再是"要不要"的问题)。

---

## Quick Start (新窗口必读路径)

按下面流程进行, 不要绕过:

### 第 1 步: 确认走哪条 branch (即确认在三阶段路径的哪一阶段)

- 文章质量还没稳定 (现在的默认状态) → **走 branch-mvp** (阶段 1, MVP script)
- MVP 阶段稳定, 进入聚类阶段 → **仍走 branch-mvp** (阶段 2, 聚类 script, 扩展 `mvp/`)
- 聚类阶段稳定 → **转 branch-original** (阶段 3, 工程化, 必经)
- 不确定 → **默认 branch-mvp** (项目重心是文章质量), 或问用户

### 第 2 步: 按 branch 读必读文件

**branch-original (基础设施先建后调质量)** — 必读 8 个文件, 约 30k tokens:

| 顺序 | 文件 | 行数 | 必读理由 |
|---|---|---:|---|
| 1 | `specs/README.md` | ~120 | 本文件, branch 导航 |
| 2 | `specs/branch-original/ROADMAP.md` | ~250 | W1-W6 节点 + 推迟项状态 |
| 3 | `specs/branch-original/DECISIONS_v3.md` | ~710 | **最关键** — 上窗口锁定的所有决策 |
| 4 | `CLAUDE.md` | ~250 | 全局规则、code-over-AI 表 |
| 5 | `CONSTRAINTS.md` | ~200 | 红线 |
| 6 | `DATA_MODEL.md` | ~700 | W1 第一动作要改 skeleton_templates 表, 必看现状 |
| 7 | `inherited_rules.md` | ~600 | W1 启动前第一动作要改 §9 |
| 8 | `data_shapes.md` | ~400 | W1 启动前第一动作要改 role_in_arc enum |

**branch-mvp (本地脚本验证质量)** — 必读 6 个文件, 约 22k tokens:

| 顺序 | 文件 | 行数 | 必读理由 |
|---|---|---:|---|
| 1 | `specs/README.md` | ~120 | 本文件 |
| 2 | `specs/branch-mvp/ROADMAP.md` | ~150 | MVP 范围 |
| 3 | `specs/branch-mvp/DECISIONS_v3.md` | ~360 | MVP 差异决策 |
| 4 | `specs/branch-original/DECISIONS_v3.md` | ~710 | MVP 也要看共享决策 |
| 5 | `CLAUDE.md` | ~250 | 全局规则 |
| 6 | `inherited_rules.md` | ~600 | 写脚本时查规则 |

### 第 3 步: 按需 view 其他文件

不必读, 用到再 view:

- `ARCHITECTURE.md` — branch-original 走到 W2+ 才用
- `IA.md` — branch-original W6 才用
- `GLOSSARY.md` — 查术语时
- `humanizer_rules.md` — branch-original W5 才用; branch-mvp 看心情
- `HANDOFF.md` / `HANDOFF_v2.md` — 历史背景, 不必读 (决策都在 DECISIONS_v3 里)

### 第 4 步: 不要做的事

- ❌ 不要重读上传的 `server.js` 或 `seo-generator-v5_2.html` (CONSTRAINTS.md B13 禁止)
- ❌ 不要回头看老对话窗口 — 所有决策已落到 DECISIONS_v3
- ❌ 不要假设两条 branch 完全独立 — 共享 §9 / enum / role 设计
- ❌ 不要跳过 DECISIONS_v3 直接改文件 — DECISIONS_v3 顶部规则比 CLAUDE.md B1 优先级更高

---

## 仓库结构

```
specs/
├── README.md                              ← 本文件
├── CLAUDE.md                              ← 全局规则
├── CONSTRAINTS.md                         ← 红线
├── ARCHITECTURE.md                        ← 系统架构
├── DATA_MODEL.md                          ← 25 个表 schema
├── GLOSSARY.md                            ← 术语
├── IA.md                                  ← 后台 UI 信息架构
├── HANDOFF.md                             ← 第 1 → 2 窗口交接 (历史)
├── HANDOFF_v2.md                          ← 第 2 → 3 窗口交接 (历史)
├── reference/
│   ├── inherited_rules.md                 ← 17 节内容规则
│   ├── humanizer_rules.md                 ← 24 条反 AI 规则
│   └── data_shapes.md                     ← 12 个 JSONB shape
├── branch-original/                       ← 原计划路径
│   ├── ROADMAP.md                         ← W1-W6 节点
│   └── DECISIONS_v3.md                    ← 上窗口锁定决策 (完整版)
└── branch-mvp/                            ← MVP 本地脚本路径
    ├── ROADMAP.md                         ← MVP 范围
    └── DECISIONS_v3.md                    ← MVP 差异决策
```

---

## 三个 HANDOFF 文件的关系

历史时间线:

```
窗口 1 (老对话) → HANDOFF.md → 窗口 2
窗口 2 → HANDOFF_v2.md → 窗口 3 (本窗口)
窗口 3 (本窗口) → DECISIONS_v3.md (branch-original + branch-mvp) → 下窗口
```

**为什么 v3 改成 DECISIONS_v3 而不是 HANDOFF_v3?**

因为本窗口讨论中决定建 branch, 把"交接内容"按 branch 分开。HANDOFF_v1/v2 是单线推进, DECISIONS_v3 是分支推进。

**HANDOFF 和 DECISIONS_v3 的内容差异**:
- HANDOFF.md / HANDOFF_v2.md: 单一时间线, 全部决策混在一起
- DECISIONS_v3: 分 branch, 每条 branch 的决策独立, 共享决策在 branch-original 里详写, branch-mvp 引用

---

## 两条 branch 是什么 (是先后阶段, 不是平行选项)

### branch-mvp — 阶段 1 (MVP script) + 阶段 2 (聚类 script)

- **逻辑**: 写本地 TS 脚本, 输入关键词输出 markdown。围绕它反复迭代: 跑 → review → 调 prompt/约束/字数/§9 → 再跑, 直到质量稳定 (见 `branch-mvp/DECISIONS_v3.md §F`)
- **阶段 1 (MVP)**: 单关键词单篇文章, 验证文章质量从每个角度都过关 (AI percentage / 段落质量 / 句长方差 / 关键词密度 / 信息增益等, 见 `branch-mvp/DECISIONS_v3.md §D.3`)
- **阶段 2 (聚类)**: MVP 稳定后在 `mvp/` 基础上扩展, 加聚类逻辑, 让相近关键词产出差异化文章。仍是脚本, 不引入 DB。详细 spec 留到聚类专属窗口
- **`mvp/` 文件持续迭代不丢弃**: 阶段 2 直接基于阶段 1 的脚本扩展
- **何时在这**: 文章质量还没稳定 (阶段 1), 或 MVP 稳定但聚类还没做 (阶段 2)

### branch-original — 阶段 3 (工程化, mandatory)

- **逻辑**: 按 W1-W6 把质量已稳定的 prompt/约束工程化成 Web 系统 (Neon + Trigger.dev + Upstash + Next.js admin + 飞书推送 + 自动 QC + 完整 humanizer)
- **前置条件**: 阶段 1 + 阶段 2 已经稳定 (MVP 单篇过关 + 聚类多篇差异化都稳定)
- **风险**: 如果跳过质量迭代或聚类直接来这, W4 才出第一篇文章, 出来质量烂就 W1-W3 回炉
- **何时进这**: 阶段 2 (聚类) 稳定后, **必经** — 不是"要不要工程化"的二选一。Feishu 推送 / 自动 QC / 完整 humanizer / admin UI 都是必做项

### 两条 branch 共享的决策

不管在哪个阶段, 以下决策都成立 (详见 `branch-original/DECISIONS_v3.md`):

- §9 重构: role_in_arc enum 是 role 库, 代码驱动结构
- enum 扩展: 8 → 20 值
- TL;DR 是 INTRO_PAIN 子规则
- gen_plan 是 fork 点, 两个 mode 都消费 SERP gap
- Help Don't Sell 写作 pattern
- 1500 字 floor
- ME mode 软读 brand placement
- keyword 预选 v1 不自动化

### 两条 branch 的差异

| 维度 | branch-original | branch-mvp |
|---|---|---|
| 输出形态 | Web app + DB + jobs | 本地 markdown 文件 |
| 数据存储 | Neon Postgres | 文件系统 + JSON |
| Mode 范围 | DIRECTOR + ME 都做 | 只 DIRECTOR |
| Intent 范围 | 5 个全做 | 1 个 (默认 solve) |
| QC 自动化 | 完整 humanizer L1+L2 | 人眼 review |
| Publish 流程 | Feishu 推送 | 文件输出, 用户手动 review |
| Prompts 存储 | DB 表, 有版本管理 | 脚本顶部 const (MVP 豁免 B11) |
| 时间预估 | 6 个窗口 (W1-W6) | 1 个窗口写完跑通 |

---

## 启动新窗口的标准句

复制粘贴到新窗口的第一条消息:

### 走 branch-original

```
我在做 ZIXEL SEO 内容工厂系统的 spec, 接着上一个窗口的进度继续 (branch-original 路径)。
先读这些文件:

1. /mnt/user-data/uploads/specs/README.md
2. /mnt/user-data/uploads/specs/branch-original/ROADMAP.md
3. /mnt/user-data/uploads/specs/branch-original/DECISIONS_v3.md
4. /mnt/user-data/uploads/CLAUDE.md
5. /mnt/user-data/uploads/CONSTRAINTS.md
6. /mnt/user-data/uploads/DATA_MODEL.md
7. /mnt/user-data/uploads/inherited_rules.md
8. /mnt/user-data/uploads/data_shapes.md

读完后告诉我:
1. 你看完了哪些
2. 上次锁定到什么程度 (对照 DECISIONS_v3 的 12 条决策)
3. 然后我们从 W1 启动前必做项开始

继续用英文。
```

### 走 branch-mvp

```
我在做 ZIXEL SEO 内容工厂系统, 走 MVP 路径 (branch-mvp)。
先读这些文件:

1. /mnt/user-data/uploads/specs/README.md
2. /mnt/user-data/uploads/specs/branch-mvp/ROADMAP.md
3. /mnt/user-data/uploads/specs/branch-mvp/DECISIONS_v3.md
4. /mnt/user-data/uploads/specs/branch-original/DECISIONS_v3.md
5. /mnt/user-data/uploads/CLAUDE.md
6. /mnt/user-data/uploads/inherited_rules.md

读完后告诉我:
1. 你看完了哪些
2. MVP 范围你理解了什么 (对照 branch-mvp/DECISIONS_v3 的 TL;DR 表)
3. 然后我们决定先写 mvp/run.md 规格还是先改 §9

继续用英文。
```

---

## 紧急 fallback: 两条 branch 都不知道怎么走

如果新窗口看完所有文件还是不知道怎么动手, 做这个:

1. 问用户: "我看完了 spec, 但是不确定该走 branch-original 还是 branch-mvp。你能告诉我:
   - 这次窗口你希望我做出什么具体输出?
   - 你有 ZIXEL 已经生成的文章可以参考质量吗?
   - 你时间紧吗(需要快出 demo)还是想正经做?"
2. 用户回答后, 重新评估走哪条 branch
3. 仍不确定 → 默认走 branch-mvp (风险更低)

---

**END of README**
