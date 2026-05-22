# HANDOFF.md — Context for new conversation window

> 这个文件是从老对话窗口交接给新窗口的上下文摘要。新 Claude 读完这个文件 + 所有 spec,就能从上次断点继续。

---

## 项目一句话

ZIXEL SEO 内容工厂系统 — 关键词 → 文章流水线,Next.js + Neon + Trigger.dev + Upstash 技术栈,目标抗 AI 检测 + 抗 Google helpful content update。

---

## Spec 进度全表

### 第一批 (核心架构文档) — ✅ 完成
- `CLAUDE.md` — 全局约束、窗口启动序列、code-over-AI 规则
- `CONSTRAINTS.md` — A 系统不变量 + B Claude Code 行为规则 + C 红线
- `ARCHITECTURE.md` — 两条流水线、双 flow 模块、LLM Gateway、25 个表的结构关系
- `DATA_MODEL.md` — 25 个表完整 schema
- `GLOSSARY.md` — 全部术语定义带例子
- `IA.md` — 10 个顶级菜单、所有页面、隐藏的 ME 模式 toggle

### 第二批组 1 (规则与数据) — ✅ 完成,但有待修订项
- `reference/inherited_rules.md` — 5 intent_types / 10 roles / 10 categories / 5 products + features / 60+ forbidden_terms / 10 skeleton 模板 / blocked_keywords / 关键词归一化 / EEAT 决定 (§16)
- `reference/humanizer_rules.md` — 24 条 humanizer 规则,Layer 1 (15 条 code) + Layer 2 (9 条 LLM)
- `reference/data_shapes.md` — 12 个 JSONB 字段的 TypeScript shape + 真实样例

### 第二批组 2 — ❌ 未开始
- `reference/model_recipes.md` — 每个 LLM 调用点的模型分配(经济/平衡/最高质量三档)
- `reference/env_vars.md` — 环境变量完整清单 + 用途
- `reference/initial_sources.md` — content_sources 表的白/灰/黑名单种子

### 第二批组 3 — ❌ 未开始
- `reference/api_contracts.md` — 所有 API endpoint 定义
- `reference/llm_gateway.md` — LLMGateway 接口 + Provider adapter 接口
- `reference/trigger_job_contracts.md` — 14 个 Trigger.dev job 的 input/output schema

### 第三批 prompts — ❌ 未开始
- `prompts/normalize_keyword.md`
- `prompts/intent.md`
- `prompts/plan.md`
- `prompts/skeleton.md`
- `prompts/section_generic.md`
- `prompts/section_zixel.md`(DIRECTOR + ME 两版)
- `prompts/section_steps.md`
- `prompts/qc_humanizer_l2.md`
- `prompts/qc_quality_l2.md`
- `prompts/parse_hot_report.md`
- `prompts/fetch_competitor.md`

### 第四批 windows — ❌ 未开始
- `windows/W1.md` ~ `W6.md` — 6 个开发窗口的 task cards

---

## 关键决定(已锁定,不要再讨论)

| 主题 | 决定 |
|---|---|
| 技术栈 | Next.js 15 + Neon + Trigger.dev v3 + Upstash Redis + Drizzle |
| Auth | v1 不做,W6 视需要加 Clerk |
| Supabase 迁移 | 预留入口,但代码不能用 Supabase 专属 SDK,只走 Postgres 协议 |
| 5 个 intent_type | learn / solve / choose / replace / understand(沿用旧版,5 个,不变) |
| 10 个 role | 沿用旧版,role 仅用于路由不进 section prompt |
| 10 个 category | 沿用旧版,固定 |
| Flow mode | DIRECTOR(默认,可见) + ME(隐藏 toggle)。两个 mode 物理分离到 `lib/flow/director/` 和 `lib/flow/me/` |
| ZIXEL 段处理 | DIRECTOR 永远有 / ME 在 learn 和 understand 跳过,solve/choose/replace 保留 |
| 多模型分工 | 现用 Moonshot Kimi K2 + DeepSeek;Claude API 预留;关键工序用 Kimi,量大工序用 DeepSeek |
| Code-over-AI | 能用代码就别用 LLM,humanizer / quality QC 都是两层(code 先 LLM 后) |
| 差异化策略 | gen_plan 不强制找差异点;4 个 outcome(ANGLE_GAP/DEPTH/STANDARD/EXECUTION) |
| 段落级独立 | article_sections 独立行,可单独重生成 |
| QC 失败处理 | 进 Quality > Pending,人工或自动重生成 |
| 热点流水线 | OpenClaw / AI HOT / 手动粘贴 3 个通道,拆选题跳过 gen_intent 直接 gen_plan |
| Steps 缺失 | 文章状态 WAITING_FOR_STEPS,不编造 |
| Prompts | 全在 prompts 表里有版本管理,不硬编码 |
| 飞书集成 | App ID/Secret/App Token/Table ID/Folder Token 全要,Webhook 仅用于失败告警(可选) |
| 中文数据源 | content_sources 表分白/灰/黑,系统照常用中文资料,只是聊天时 Claude 不搜中文 |
| 关键词归一化 | 10 步算法定义在 inherited_rules.md §13 |
| EEAT | 作者署名(已在 Storyblok)+ 更新时间(代码加)+ schema.org JSON-LD(W5 加);外部引用 v1 不做;CASE_STUDY 用户提供 |

---

## 还在讨论中(新窗口要解决)

### 待讨论 1 — Skeleton 段数扩展

用户反映"文章看起来太单薄"。当前 skeleton 6 段,可能扩到 8-10 段。

**已经探讨的候选新段类型**:
- `CASE_STUDY` — 实际案例段(用户说目前没多少 case,可能要等)
- `DECISION_FRAMEWORK` — 判断框架段(实操判断标准)
- `FAQ` — 常见问题段(3 个真实问题 + 简答)

**陷阱要避**:加段不加内容 = AI 凑数;每段强行加字数 = 触发 humanizer 规则。

**新窗口要做**:
- 讨论实际加哪几段、加在什么位置
- 不同 intent_type 是否加不同段
- 更新 `inherited_rules.md §9` 的 10 个 skeleton 模板
- 更新 `data_shapes.md` 的 `role_in_arc` 枚举
- 更新 `humanizer_rules.md` 给新段类型加豁免(case study 字数限制放宽等)

### 待讨论 2 — EEAT 具体实施

EEAT 已经定了大方向(见 inherited_rules.md §16),但还要决定:
- 更新时间在文章哪个位置(顶部 INTRO 之前?H1 之后?)
- schema.org JSON-LD 输出的具体字段(Article 标准字段 + FAQPage 字段)
- 给 storyblok 传哪些 metadata

---

## 用户偏好(从老对话学到的)

| 偏好 | 含义 |
|---|---|
| 直接,不绕弯 | 不要 5 段铺垫才给答案,先答再解释 |
| 不要 yes-man | 觉得用户思路有问题就直说,但用 advisor 的话他不一定能改(因为是 advisor) |
| 老实承认不会 | 不要假装懂没在 context 里的东西,需要的就问 |
| 不要重新读上传的代码 | server.js 和 HTML 是 reference,**读一次就够**,别每个回复都 view |
| 不要造数据 | ZIXEL 功能 / 竞品 / 步骤 用户没提供就不要瞎造 |
| 不要搜中文站(限聊天) | 用户的 user preferences:never search information on chinese websites — 但仅限 Claude 自己搜索,系统生产环境的中文数据源该用就用 |
| 经济考虑 | 用户目前没钱用 Claude API、没钱用 originality.ai 这些;Moonshot + DeepSeek 是当前主力;预留 Claude 接口 |
| 用中英文混合都行 | 用户用中文问,Claude 早期回复用中文,后期为省 token 切英文,用户都接受 |

---

## 用户的工作流(从记忆里学到的)

- 用户(Eskascty)是工业设计专业大四学生,2026 年 6 月毕业
- 在 ZIXEL(子虔科技)做实习,做 SEO 内容 + AI 工具相关
- 这个项目是为 ZIXEL 做的,代码 + spec 都是给 Claude Code 写的
- 用户上司(导师/advisor)倾向于"在文章里醒目推产品"的写法,但用户知道这有 Google 下架风险
- 用户开发风格:增量推进 + 频繁验证,不喜欢 AI 跳步骤

---

## 用户的导师(advisor)对项目的影响

- 导师**没看到** ME 模式的存在(隐藏在 settings toggle 后)
- 导师**坚持**每篇文章都有醒目 ZIXEL 推荐段 — 这是 DIRECTOR 模式的设计来源
- 导师**不接受**"承认局限"的写法 — 所以 DIRECTOR 模式 style anchor 删掉了这一行
- 用户 ME 模式是给自己用的实验通道,**用户私下迭代,不让导师看到**

---

## 新窗口开始时的建议第一句

复制下面这段直接发到新窗口:

```
我在做 ZIXEL SEO 内容工厂系统的 spec。先读这几个文件再继续:

1. /mnt/user-data/uploads/HANDOFF.md (这次交接的上下文)
2. /mnt/user-data/uploads/CLAUDE.md
3. /mnt/user-data/uploads/CONSTRAINTS.md
4. /mnt/user-data/uploads/ARCHITECTURE.md
5. /mnt/user-data/uploads/DATA_MODEL.md
6. /mnt/user-data/uploads/GLOSSARY.md
7. /mnt/user-data/uploads/IA.md
8. /mnt/user-data/uploads/inherited_rules.md
9. /mnt/user-data/uploads/humanizer_rules.md
10. /mnt/user-data/uploads/data_shapes.md

读完后告诉我你看到哪里、上次断在什么地方,然后我们先讨论 HANDOFF.md 里"待讨论"那两项。
```

---

## 当前断点

老窗口最后一轮处理的事:
1. 修了 `inherited_rules.md §15` 的 regex 排版(加了 # 注释说明每条 pattern 抓什么)
2. 在 `inherited_rules.md` 新增 §16 EEAT 决定表 — 锁定哪些做哪些不做
3. 旧的 §16 (Persona rules) 重新编号为 §17
4. 写了这个 HANDOFF.md

**没做**:skeleton 段数扩展、CASE_STUDY/FAQ 段设计、humanizer 豁免规则更新、data_shapes 枚举更新——**全部留给新窗口**

---

## 文件清单(新窗口需要全部上传)

最终交付到这个 conversation 的所有 markdown:

```
specs/
├── CLAUDE.md
├── CONSTRAINTS.md
├── ARCHITECTURE.md
├── DATA_MODEL.md
├── GLOSSARY.md
├── IA.md
├── HANDOFF.md                      ← 本文件
└── reference/
    ├── inherited_rules.md
    ├── humanizer_rules.md
    └── data_shapes.md
```

总行数:~3000 行 markdown。新窗口启动后,读这些预估 ~30-40k tokens。

---

## 不要做的事(写给新 Claude)

- 不要重新读老对话上传的 `server.js` 或 `seo-generator-v5_2.html` — 那是 reference,需要时再 view
- 不要重新讨论已经在"关键决定"表里锁定的项
- 不要假设用户产品功能比我列在 `inherited_rules.md §7` 里的更多 — 那张表已经从用户提供的 `Function 功能 产品介绍.md` 提取完了
- 不要造竞品数据 — competitors 表初始空,用户自己填
- 不要建议引入新依赖,严格按 `CLAUDE.md` 技术栈表
- 用户切换到英文沟通后,新窗口继续用英文(除非用户明确说切回中文)
