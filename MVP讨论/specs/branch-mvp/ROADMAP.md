# branch-mvp — ROADMAP

> branch-mvp 是验证生成质量的最快路径: 写一个本地 TS 脚本, 跑出 1 篇 ZIXEL SEO 文章, 用户眼睛 review。
>
> **MVP 不是工程化系统**, 不要在 MVP 里加 admin UI / DB / job queue。

---

## 路径定义

单脚本, 输入关键词输出 markdown。完全本地, 不连任何远程服务(除 LLM API 和 SerpAPI 这两个**必需**的外部调用)。

---

## 路径假设

- **质量验证是当前最高的不确定性**, 不是基础设施
- 一旦验证 prompt 能产出可用质量, 才有理由搭工程化系统
- 不验证质量先搭基础设施 = 浪费时间 + 浪费 token

---

## 路径风险

- **脚本写完发现 prompt 烂**: 这就是 MVP 要发现的事, **属于成功不属于失败** — MVP 就是用来暴露质量问题然后迭代的。
- **质量没稳定就急着工程化**: 质量还没收敛 (连续 2-3 篇过 review) 就想转 branch-original 搭系统 = 把没调好的 prompt 固化进工程, 回炉成本高。**Claude 要确认质量稳定才建议转工程化, 否则继续在 MVP 迭代**。
- **MVP 偷偷扩展成 mini-system**: 加 DB 加 admin 加 job queue。**Claude 要拒绝, MVP 阶段范围必须严格守住** — 这些是 branch-original 工程化阶段的事。

---

## 路径触发条件 (何时选这条)

- 从未生成过 ZIXEL SEO 文章 (现在的状态)
- advisor 不在场, 不要求看完整系统
- 用户想先看 LLM 输出再决定 prompt 调整方向(工程化是必经, 不是"要不要"的问题, 见 DECISIONS_v3 §F.4)
- 担心走 branch-original 跑到 W4 才发现质量烂, 沉没成本太大

---

## MVP 范围

### 做的事 (严格白名单)

| 项 | 实现细节 |
|---|---|
| 本地 TS 脚本 (单 entry: `mvp/run.ts`) | 用 `pnpm tsx` 跑, 不用编译 |
| 输入 1 个关键词 | `pnpm tsx mvp/run.ts "dwg 文件打不开怎么办"` |
| 输出 1 个 markdown 文件 + JSON 中间产物 | 见 §D 文件结构 |
| 4 个 LLM 调用 | classify_intent, gen_plan, gen_section × N, (可选) humanizer_l2 |
| Prompts 写在脚本里 | TypeScript 常量, 不连 prompts 表 |
| ZIXEL features 写在脚本里 | TypeScript 常量, 不连 product_features 表 |
| Role 约束逻辑写在脚本里 | TypeScript 常量, 实现 DECISIONS_v3 §B 的 validate_outline 逻辑 |
| 只跑 DIRECTOR mode | ME mode 不做 |
| 只跑 1 个 intent_type | 默认 `solve` (其他 4 个不做) |
| 基础 humanizer L1 扫描 | 字数 + ZIXEL 提及 + emoji + forbidden_terms 黑名单, 不做完整 15 条规则 |
| 文件系统作 cache | SerpAPI 结果存本地 JSON, 同 keyword 24h 内不重复调 |
| trace.json 记录每次 LLM 调用 | 包括 prompt / response / tokens / cost |

### 不做的事 (严格黑名单)

| 项 | 不做理由 |
|---|---|
| Neon Postgres | 文件系统够 |
| Trigger.dev | 直接 await, 不需要 job queue |
| Upstash Redis | 本地 JSON cache 够 |
| Next.js admin UI | 不需要管理界面 |
| Drizzle ORM | 不连 DB |
| Storyblok 推送 | 输出本地 markdown 用户自己看 |
| 飞书集成 | 同上 |
| 5 个 intent 全做 | 只验证 1 个 |
| ME mode | 等 DIRECTOR 验证完再说 |
| 热点流水线 | 不在 MVP 范围 |
| 完整 humanizer L1 (15 条规则) | 用人眼 |
| humanizer L2 LLM 评分 | 可选, 默认关 |
| QC publish 检查 (CONSTRAINTS A16/A17/A18) | MVP 不发布 |
| Trigger.dev 重试机制 | 手动 re-run 脚本 |
| Multi-intent 并行处理 | 单 keyword 单 article |

---

## MVP 任务流 (1 个开发窗口完成)

### Step 1 — 读 spec + 决定动手方式

| 子步骤 | 输出 |
|---|---|
| 读 README.md + branch-mvp/ROADMAP.md (本文件) + branch-mvp/DECISIONS_v3.md + branch-original/DECISIONS_v3.md + CLAUDE.md + inherited_rules.md | 上下文 ~22k tokens |
| 向用户确认 "我已读完两份 DECISIONS_v3, 即将 ..." | 用户 OK |
| 询问用户: 是否先改 inherited_rules.md §9 再写脚本, 还是直接写脚本 + 约束硬编码 | 选 A 或 B |

**选 A (先改 spec)**:
- 改 inherited_rules.md §9 (重写整段, 按 DECISIONS_v3 §B 内容)
- 改 data_shapes.md (role_in_arc enum 8 → 20)
- 改 DATA_MODEL.md (删 skeleton_templates 表 + 更新 article_plans 注释)
- 改 ARCHITECTURE.md (fork 点)
- 然后写脚本, 约束逻辑从 spec 引用

**选 B (脚本里硬编码)**:
- 直接写脚本, 约束逻辑写在 mvp/constants.ts
- 顶部加 ⚠️ 注释: "Violates CONSTRAINTS B11, MVP-only exemption"
- MVP 跑通后再回头改 spec (推迟成本)

**默认推荐选 A**: 因为 spec 改动是必须的(决策 4/5/6/11), 早改晚改一样。

### Step 2 — 写 mvp/run.md 规格 (~250-400 行)

按 DECISIONS_v3 §D / §E 内容铺开, 描述:

- 脚本 CLI 接口
- 文件结构 (mvp/ 目录布局)
- 4 个 LLM 调用的 input/output schema
- 4 个 prompt 草稿
- trace.json shape
- review.md 模板
- 关键失败处理 (LLM 重试 / SerpAPI 失败 / 验证失败)

### Step 3 — 写 mvp/constants.ts

```typescript
// mvp/constants.ts
export const ZIXEL_FEATURES = [/* 从用户提供的功能介绍.md 抽取 */];
export const FORBIDDEN_TERMS = [/* 从 inherited_rules.md §11 抽取核心黑名单, MVP 简化 */];
export const ROLE_WORD_TARGETS: Record<string, [number, number]> = {/* 见 DECISIONS_v3 §B.5 */};
export const UNIVERSAL_CONSTRAINTS = {/* 见 DECISIONS_v3 §B.2 */};
export const MODE_CONSTRAINTS = {/* 见 DECISIONS_v3 §B.3, MVP 只用 DIRECTOR */};
export const INTENT_CONSTRAINTS = {/* 见 DECISIONS_v3 §B.4 */};
```

### Step 4 — 写 mvp/prompts.ts

4 个 prompt:

| Prompt | 输入 | 输出 |
|---|---|---|
| classifyIntent | keyword | { intent_type, scenario } |
| genPlan | keyword, intent_type, competitor_outlines, product_features | { thesis_summary, suggested_outline[] } |
| genSection | role, brief_hint, word_target, thesis, position, total, product_features, keyword | { markdown } |
| humanizerL2 (可选) | full_markdown | { score, issues[] } |

每个 prompt 体现:
- DECISIONS_v3 §D (INTRO_PAIN 的 TL;DR 子规则)
- DECISIONS_v3 §H.1 (BRIDGE_TO_PRODUCT 的 Help Don't Sell pattern)
- inherited_rules.md §1 (persona) + §2 (anti-verbose) + §3 (style anchor)
- inherited_rules.md §11 (forbidden_terms 提示)

### Step 5 — 写 mvp/run.ts (主脚本)

实现 DECISIONS_v3 §E 的伪代码:
1. CLI parse keyword
2. classifyIntent
3. fetchSerpOutlines (含本地 JSON cache)
4. genPlan (含 validate + retry 最多 3 次)
5. genSection × N (并行)
6. assembleArticle (拼接 markdown + 加 frontmatter)
7. quickHumanizerScan
8. (可选) humanizerL2
9. writeOutputs (article.md, trace.json, plan.json, review.md, humanizer_scan.json)

### Step 6 — 跑一次

```bash
pnpm tsx mvp/run.ts "dwg 文件打不开怎么办"
```

预期看到:
- 4 个 stage 各自的 console output
- 最后输出 `✅ Done. Article at output/dwg-wenjian-dabukai-{timestamp}/article.md`

### Step 7 — 用户 review (覆盖文章质量的每个角度)

用户打开 `output/.../article.md` 看文章。打开 `review.md` 模板手填 (完整维度见 DECISIONS_v3 §D.3):

**基础维度**:
- 字数达标? Y/N
- 关键词嵌入自然? Y/N
- AI 味? 1-5 分
- 信息增益? 满足几条? (一手经验/独家数据/整合洞察, 至少 1 种)
- Help Don't Sell 体现? Y/N
- TL;DR 首句独立? Y/N
- 反贬损? Y/N

**扩展维度 (覆盖文章质量的每个角度, 必填)**:
- AI 检测分数: ___% (跑过 AI detector, 记工具名 + 百分比)
- 段落级质量: 逐段标注 (不过关的段写原因)
- 关键词密度: ___次 / ___%
- 句长方差: 有无连续 3 句以上同长度
- 禁用词命中: 数量 + 命中词 (Kazik 清单见 `reference/kazik_adaptation.md`)
- 信息增益形式: 哪种 + 在哪段
- 可读性: 有无术语堆叠的段落

### Step 8 — 决策分叉 (单篇过关 ≠ 收敛)

| Review 结果 | 下一步 |
|---|---|
| 单篇过关 | **还不够** — 换关键词再跑 2-3 篇, 确认质量稳定 (不是运气) |
| 连续 2-3 篇过关 (质量收敛 ✅) | 进入聚类阶段 (DECISIONS_v3 §F.5) → 之后进入工程化阶段 (§F.6, branch-original W1)。三阶段都必经, 不是"要不要工程化"的二选一 |
| 部分维度不行 | 调具体维度 (prompt / brief_hint / 约束 / 字数) → re-run。这是**迭代的常态, 不是失败** |
| 整体不行 | 大改方向 (intent 加 sub_pattern / 重新设计 §9 / 换 model) → re-run |

**核心**: Step 6-8 不是一次性的, 是**循环**。回到 Step 6 再跑, 直到连续多篇稳定。详见 DECISIONS_v3 §F 迭代框架。

---

## 迭代循环 + 三阶段固定路径

```
       ┌──────────────────────────────────┐
       │  (Step 6) 跑 MVP 一个关键词      │←──────┐
       └────────────────┬─────────────────┘       │
                        ↓                          │
       ┌──────────────────────────────────┐        │
       │  (Step 7) 用户 review (review.md) │        │
       └────────────────┬─────────────────┘        │
                        ↓                           │
                连续 2-3 篇稳定?                     │
                  ┌─────┴─────┐                     │
                  ↓           ↓                     │
                 否          是 (收敛 ✅)            │
                  │           │                     │
                  ↓           ↓                     │
       ┌──────────────┐  ┌────────────────────────┐│
       │ 调整 + re-run│  │ 三阶段路径 (都必经):    ││
       │ - prompts    │  │ 阶段1 ✅ MVP script     ││
       │ - §9 约束    │  │     ↓                   ││
       │ - 字数表     │  │ 阶段2 聚类 script (§F.5)││
       │ - sub_pattern│  │     ↓                   ││
       └──────┬───────┘  │ 阶段3 工程化 (§F.6,     ││
              │          │    branch-original W1)  ││
              │          └────────────────────────┘│
              └────────────────────────────────────┘
```

**调整对象按成本** (见 DECISIONS_v3 §F.2): prompt 措辞 (低) < brief_hint (低) < 字数表 (中) < §9 约束表 (中) < sub_pattern (高) < 换 model (高)。

**纪律**: §9 约束表 / 字数表 / enum 是两 branch 共享的 spec 层改动, 改完两边同步, 不让 MVP 私自分叉。

### 收敛后若转 branch-original, MVP 产物怎么用

| MVP 产物 | 合并到 branch-original 哪里 |
|---|---|
| 迭代稳定的 prompts (`mvp/prompts.ts`) | seed 进 `prompts` 表 (W2) |
| 迭代稳定的 ZIXEL features (`mvp/constants.ts` 中) | seed 进 `product_features` 表 (W2) |
| 迭代稳定的 role 约束 (`mvp/constants.ts` 中) | 已经在 inherited_rules §9 (W1 前完成) |
| trace.json 样例 | 作为 W2 测试用例参考 |

### MVP 不能合并的东西

| 项 | 不能合并理由 |
|---|---|
| mvp/run.ts 本身 | branch-original 用 Next.js + Trigger.dev workers, 脚本作废 |
| 文件系统 cache | branch-original 用 Redis, 文件 cache 作废 |
| 硬编码常量 | branch-original 用 DB, 常量作废 |

---

## MVP 不会出现的"扩展冲动" (Claude 注意)

如果用户在 MVP 阶段说以下话, **Claude 应该拒绝并解释 MVP 范围**:

| 用户可能说的话 | Claude 应该回答 |
|---|---|
| "MVP 加个 admin 页面方便查 trace" | "这是工程化范围, 用 `cat output/.../trace.json` 看够了。等 MVP 跑通进 branch-original W6 再加 admin。" |
| "把 prompts 表也加进去, 方便改 prompt" | "MVP 改 prompt 直接改 `mvp/prompts.ts` 然后 re-run。表是 W2 的范围。" |
| "加 Trigger.dev 排队, 我想同时跑 10 个关键词" | "MVP 验证质量, 不验证并发。1 个关键词够了, 跑通后再说。" |
| "加 ME mode" | "MVP 只验证 DIRECTOR。ME 是 advisor 不见的版本, 跑通 DIRECTOR 再做。" |
| "顺便把 5 个 intent 都做了" | "1 个 intent 跑通了再说。5 个意味着 5 套 prompt + 5 套测试, MVP 范围超了。" |
| "把数据存 Postgres 而不是文件" | "文件系统对 1 个关键词够了。DB 是 W1 的范围。" |
| "加 humanizer L1 完整 15 条规则" | "MVP 用人眼 review。完整 L1 是 W5 范围。简化 5 条已经够 sanity check。" |

---

## 时间预估

- Step 1 (读 spec + 决定): 1 个对话回合
- Step 2 (写 run.md): 1 个对话回合, ~300 行 markdown
- Step 3-5 (写代码): 2-3 个对话回合, ~600-1000 行 TS
- Step 6 (跑一次): 1 个对话回合
- Step 7-8 (review + 决策): 用户操作, 不占 Claude 窗口

**总计**: 5-6 个对话回合在 1 个 Claude Code 窗口里完成。Token 预估 ~ 80-120k 窗口总消耗。

---

## 失败的可能场景

| 失败模式 | 处理 |
|---|---|
| LLM API key 不可用 | 检查 .env, 申请新 key |
| SerpAPI 返回空或被 ban | fallback 到 "no competitor outlines" 模式, gen_plan 不用 SERP gap |
| LLM 输出 JSON 解析失败 | 重试 1 次, 还失败 → log + skip 该 section, 整篇文章可能短 1 段 |
| gen_plan 重试 3 次都 validate 不过 | log + 停, 让用户看 validation reason 决定调约束还是调 prompt |
| 跑出的文章字数差很多 (比如 800) | 检查 role_word_targets 是不是不切实际, 或者 gen_section 没遵守 word_target |
| ZIXEL 提及 0 次 | 检查 BRIDGE_TO_PRODUCT prompt 有没有正确把 ZIXEL 嵌入 |
| 信息增益完全没有 | 这是核心 prompt 问题, 需要回头改 prompt + role brief_hint |

---

**END of ROADMAP (branch-mvp)**
