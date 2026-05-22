# DECISIONS_v3 — branch-original

> ⚠️ **下窗口必读**: 本文件包含上一窗口锁定的所有决策。在改任何 spec 文件前, 你必须**完整读完本文件**(不只 TL;DR)。读完后向用户确认"我已读完 DECISIONS_v3, 即将改 [文件名] 的 [section], 方向是 [一句话总结]"才能动手。这条规则比 CLAUDE.md 的 B1 优先级更高。

> **本文件适用于 branch-original**(按原计划路径推进, W1-W6, 基础设施先建后调质量)。如果走 branch-mvp, 也要读本文件——只是其中部分决策 MVP 阶段不实施(详见 `branch-mvp/DECISIONS_v3.md` 的差异表)。

---

## TL;DR — 决策总览(60 秒看懂)

| # | 决策 | 影响 spec 文件 | 优先级 |
|---|---|---|---|
| 1 | 收到写作要求文档,1500字 floor 保留 | CONSTRAINTS.md A12 | W3 前 |
| 2 | ME mode brand placement 软读: body 必须含 ≥1 次 ZIXEL/子虔提及 | humanizer L1, CONSTRAINTS A16 | W3 前 |
| 3 | keyword 预选 SOP v1 不自动化 | CLAUDE.md 文档地图 | 备注 |
| 4 | **§9 重构: enum 是 role 库, 代码驱动结构, LLM 在 gen_plan 选 role** | inherited_rules.md §9 全改 | **W1 前** |
| 5 | role_in_arc enum: 8 → 20 个值 | data_shapes.md, DB migration | **W1 前** |
| 6 | skeleton_templates 表删除(约束逻辑搬到代码) | DATA_MODEL.md | **W1 前** |
| 7 | TL;DR 是 INTRO_PAIN 子规则, 不单独成 role | inherited_rules.md, prompt | W4 前 |
| 8 | CONSTRAINTS 新增 A16/A17/A18 (brand mention / no external links / no contact patterns) | CONSTRAINTS.md | W3 前 |
| 9 | A19 title / A20 disparagement 不进 CONSTRAINTS, 下放 | inherited_rules §19, humanizer rule 28 | W3-W5 前 |
| 10 | humanizer 新规则 25-29 + 三个豁免 | humanizer_rules.md | W5 前 |
| 11 | DIRECTOR 和 ME 在 gen_plan fork, 都消费 competitor_outlines | ARCHITECTURE.md | **W1 前** |
| 12 | CLAUDE.md 加 "Help Don't Sell" 第三原则 | CLAUDE.md | W4 前 |

**下窗口必做(W1 启动前)**: 决策 4 / 5 / 6 / 11 落到 spec 文件 + 写 env_vars.md + 写 windows/W1.md

---

## A. 写作要求文档(SEO-注意&SOP.md)接收 + Conflict 解决

### A.1 文档关键信息

收到了用户写作要求 SOP 文档, 关键 takeaways:

- **品牌植入硬要求**: 每篇文章必须有"自身品牌(相关产品)植入"
- **反贬损硬要求**: "内容涉及产品对比, 不得直接宣传/抨击、贬低其它公司品牌、产品信息"
- **正面调性要求**: 不得涉及政治/不文雅/违规, 不得违反广告法
- **格式硬要求**: storyblok 后台编辑器, 不得用 135 编辑器排版
- **标题硬要求**: 10-30 字, 含核心关键词且位置靠前, 三种格式(单标题/双标题/特殊前后缀), 不得标题党
- **结构硬要求(doc 表述)**: 引言 100-200 字 + 主体 500-1200 字 + 尾段 100-150 字, 总数 700-1450 字
- **第一个小标题硬要求**: 直接解决关键词所在问题(加案例/数据/实操步骤)
- **延伸内容要求**: FAQ、列表、问答等结构提升专业性
- **信息增益原则**: 4 种实现方式(一手经验/独家数据/整合性洞察/可视化资产), 每篇至少占 1 条最好 2+
- **"Help Don't Sell"营销模式**: doc 明确举例对比, 是营销段写作的核心 pattern
- **合规黑名单**: 二维码/电话/个人微信QQ/微信群QQ群 等推广信息禁止在正文; 站外链接禁止(除特殊允许)
- **禁字**: 错别字/繁体/生僻字/低俗/特殊符号(含表情)/全英文标题

### A.2 三个 Conflict 与本窗口锁定

**Conflict 1 — 字数 floor**

- Doc 要求: 总字数 700-1450 字
- 现有 CONSTRAINTS A12: 1500 字硬 floor
- **锁定**: 保留 1500 字硬 floor, 把 doc 数字理解为**每段的 minimum 推荐区间**, 不是总字数上限
- 实施: CONSTRAINTS A12 文案修订 + inherited_rules §20 (字数表) 给出每段 minimum (doc 数字) + maximum (用 role_word_targets 自定)

**Conflict 2 — ME mode brand placement**

- Doc 要求: 每篇文章必须有品牌植入
- 现有设计: ME mode 在 learn/understand intent 跳过 BRIDGE_TO_PRODUCT 段
- **锁定**: 软读 — 不要求每篇都有 BRIDGE_TO_PRODUCT 段, 但要求 body markdown 必须含 ≥1 次 "ZIXEL" 或 "子虔" 提及
- 实施: humanizer rule 25 (L1 code 扫) + CONSTRAINTS A16 + ME mode 的 REAL_USAGE 段 prompt 指示自然提及一次

**Conflict 3 — keyword 预选 SOP**

- Doc 要求: 编辑用 Baidu 无痕模式做 SERP 预审, 决定该关键词能否写
- 现有设计: 系统没这个环节
- **锁定**: v1 不自动化, manual only (编辑手动在 import 前判断)
- 实施: CLAUDE.md 文档地图加备注; keywords 表暂不加 `pre_check_status` 字段, 未来加

---

## B. §9 重构 (核心决定, 两条 branch 共享)

> 这是本窗口**最大的决策**。原 §9 是 10 个固定 skeleton 模板(5 intent × 2 mode), gen_skeleton 阶段查表。新设计: role_in_arc enum 是 role 库, 结构由代码约束 + LLM 在 gen_plan 选 role 组装。**完全删除固定模板设计**。

### B.1 核心决定

- `role_in_arc` enum 是**段落能力库**(20 个值, 见 §C)
- gen_plan 阶段 LLM 从 enum 里**挑 5-9 个 role** 组成 outline, 同时给每个 role 一个 `brief_hint`
- gen_skeleton 阶段**完全代码驱动** — 验证 LLM 的 role 选择符合约束规则, 不符合就重试 gen_plan
- gen_skeleton **不再做 LLM 调用** (code-over-AI 完整应用)

### B.2 通用约束 (universal, 不分 mode/intent)

```typescript
const UNIVERSAL_CONSTRAINTS = {
  min_sections: 5,
  max_sections: 9,

  must_start_with: "INTRO_PAIN",          // 第一段恒定 INTRO_PAIN (TL;DR 在它里面)
  must_end_with_one_of: ["FAQ", "CTA"],   // 最后一段 FAQ 或 CTA

  required_roles: ["INTRO_PAIN", "FAQ"],   // 任何文章都要有这两个

  ordering_rules: [
    "INTRO_PAIN must be position 0",
    "FAQ must be position N-1 or N-2 (allow CTA to follow)",
    "BRIDGE_TO_PRODUCT, if present, must be position N-3 or N-2 (just before FAQ/CTA tail)",
    "CTA, if present, must be the last position",
  ]
};
```

**理由记录**:
- FAQ 通用必有 → AEO + GEO 需要 (你在 Q1 锁定: 两个 mode 都加 FAQ)
- INTRO_PAIN 通用必有且 position 0 → TL;DR 句子的承载位置
- BRIDGE_TO_PRODUCT 不进通用约束 → ME × learn/understand 不强制要

### B.3 Mode 约束

```typescript
const MODE_CONSTRAINTS = {
  DIRECTOR: {
    required_roles_in_addition: ["BRIDGE_TO_PRODUCT", "CTA"],
    forbidden_roles: [],
    has_thesis: true,                     // gen_plan 必须输出 thesis_feature_id
    bridge_position: "before_tail",       // 在 FAQ 之前
  },

  ME: {
    required_roles_in_addition: [],
    forbidden_roles: ["CTA"],             // ME 永远没 CTA (用户 Q1 锁定)
    has_thesis: false,                    // ME 不挑 thesis_feature
    soft_brand_mention_required: true,    // body 必须含 ≥1 次 ZIXEL/子虔 (humanizer L1 code 扫)
  }
};
```

**理由记录**:
- DIRECTOR has_thesis = true: HANDOFF_v2 决定 2 锁定
- DIRECTOR 永远有 CTA: advisor 要求醒目转化收尾
- ME 永远没 CTA: 用户偏好, 私下迭代不需要导师式收尾
- ME soft_brand_mention_required: 由 humanizer rule 25 (L1) 扫描验证

### B.4 Intent 约束 (简化版, MVP 阶段够用)

```typescript
const INTENT_CONSTRAINTS = {
  learn: {
    forbidden_roles: ["WHY_LEAVING", "MIGRATION_BLOCKERS"],
    required_roles: ["DEFINITION"]
  },
  understand: {
    forbidden_roles: ["WHY_LEAVING", "MIGRATION_BLOCKERS", "HOW_TO_STEP"],
    required_roles: ["WHEN_TO_USE_WHICH"]
  },
  solve: {
    forbidden_roles: ["WHY_LEAVING", "MIGRATION_BLOCKERS"],
    required_roles: ["HOW_TO_STEP"]
  },
  choose: {
    forbidden_roles: ["WHY_LEAVING", "MIGRATION_BLOCKERS"],
    required_roles: ["DECISION_FRAMEWORK"]
  },
  replace: {
    forbidden_roles: [],
    required_roles: ["WHY_LEAVING", "HOW_TO_STEP"]
  }
};
```

**重要警告**: 用户在 step 3 讨论中指出 `solve` 实际上有两个子类型(操作指导型 vs 诊断分析型), 当前简化版**没有区分**。这是**已知设计缺口**, 不是 bug。 处理路径有两条:

- **路径 1 (推迟决定)**: v1 不区分, LLM 在 gen_plan 自由发挥, 看真实输出再决定要不要加 `sub_pattern` 字段
- **路径 2 (现在加)**: 在 keyword_intents 表加 sub_pattern 字段, intent 约束表按 (intent, sub_pattern) 两轴设计

**本窗口锁定**: **路径 1**。理由: 不验证质量先细分 = 过早优化。下窗口 W3 阶段如发现质量问题再回头加。

**typical_middle_roles 和 discouraged_roles 推迟**: 这两个字段在窗口讨论中提过但未锁定。理由同上 — LLM 自由发挥, 跑出来再加。下窗口**不要主动加这两个字段**。

### B.5 字数目标表 (role_word_targets)

```typescript
const ROLE_WORD_TARGETS: Record<string, [number, number]> = {
  INTRO_PAIN: [100, 200],
  DEFINITION: [100, 180],
  MECHANISM: [200, 300],
  ANALYZE_CAUSE: [200, 280],
  HOW_TO_STEP: [250, 350],                    // 操作密集, 可以更高
  COMMON_MISTAKES: [150, 250],
  SCENARIO_BREAKDOWN: [180, 280],
  WHEN_TO_USE_WHICH: [200, 300],
  COMPARE_OPTIONS: [200, 280],
  DIMENSION_ANALYSIS: [200, 300],
  DECISION_FRAMEWORK: [180, 260],
  LIMITATIONS_OF_CATEGORY: [150, 250],
  WHY_LEAVING: [150, 220],
  MIGRATION_BLOCKERS: [200, 280],
  REAL_USAGE: [180, 260],
  BRIDGE_TO_PRODUCT: [200, 280],
  FAQ: [200, 350],                            // 3 Q-A pairs, 每对约 60-100 字
  CTA: [30, 80],                              // 短促有力
  CONTEXT: [150, 220],
  CONCLUSION: [100, 150]
};
```

**计算示例 — DIRECTOR × solve 7 段**:
- INTRO_PAIN (150) + ANALYZE_CAUSE (240) + SCENARIO_BREAKDOWN (230) + HOW_TO_STEP (300) + COMMON_MISTAKES (200) + BRIDGE_TO_PRODUCT (240) + FAQ (270) + CTA (50) = **1680 字** ✅ 过 1500 floor

**计算示例 — ME × learn 5 段**(无 BRIDGE, 无 CTA):
- INTRO_PAIN (150) + DEFINITION (140) + MECHANISM (250) + REAL_USAGE (220) + FAQ (270) = **1030 字** ❌ 不过 1500 floor

**这意味着**: ME × learn / understand 配置的最小段数实际上是 **6 段**, 需要再加 1 个 typical role (比如 COMMON_MISTAKES 或 SCENARIO_BREAKDOWN)。gen_plan prompt 要给 LLM 足够空间挑 6-7 个 role 即使是 ME × learn。

### B.6 gen_plan 输出 shape

```typescript
type GenPlanOutput = {
  thesis_feature_id?: string;        // DIRECTOR 必填, ME 空
  thesis_summary?: string;           // DIRECTOR 必填, 一句话产品价值点
  differentiation_strategy: "ANGLE_GAP" | "DEPTH" | "STANDARD" | "EXECUTION";
  suggested_outline: Array<{
    role: RoleInArc;                 // enum 值, 见 §C
    brief_hint: string;              // 这段写什么, 一句话
    estimated_words: number;         // 落在 ROLE_WORD_TARGETS 区间内
  }>;
  serp_gap_notes?: string;           // 两个 mode 都收集, 见 §G
};
```

### B.7 gen_skeleton 验证逻辑 (代码驱动)

```typescript
function validate_outline(
  outline: GenPlanOutput['suggested_outline'],
  intent: IntentType,
  mode: FlowMode
): ValidationResult {

  // 1. 段数检查
  if (outline.length < UNIVERSAL.min_sections) return reject("太少");
  if (outline.length > UNIVERSAL.max_sections) return reject("太多");

  // 2. 起始/结尾
  if (outline[0].role !== "INTRO_PAIN") return reject("第一段必须 INTRO_PAIN");
  const last = outline[outline.length - 1].role;
  if (!UNIVERSAL.must_end_with_one_of.includes(last)) return reject("最后必须 FAQ 或 CTA");

  // 3. 必须含 (universal + mode + intent)
  const required = [
    ...UNIVERSAL.required_roles,
    ...MODE_CONSTRAINTS[mode].required_roles_in_addition,
    ...INTENT_CONSTRAINTS[intent].required_roles
  ];
  for (const r of required) {
    if (!outline.find(s => s.role === r)) return reject(`必须含 ${r}`);
  }

  // 4. 禁止
  const forbidden = [
    ...MODE_CONSTRAINTS[mode].forbidden_roles,
    ...INTENT_CONSTRAINTS[intent].forbidden_roles
  ];
  for (const s of outline) {
    if (forbidden.includes(s.role)) return reject(`禁止用 ${s.role}`);
  }

  // 5. 顺序: BRIDGE_TO_PRODUCT 在尾部前
  const bridgeIdx = outline.findIndex(s => s.role === "BRIDGE_TO_PRODUCT");
  if (bridgeIdx >= 0 && bridgeIdx < outline.length - 3) {
    return reject("BRIDGE_TO_PRODUCT 必须在尾部前两位以内");
  }

  // 6. 字数
  for (const s of outline) {
    const [min, max] = ROLE_WORD_TARGETS[s.role];
    if (s.estimated_words < min || s.estimated_words > max) {
      return reject(`${s.role} 字数 ${s.estimated_words} 不在 ${min}-${max} 区间`);
    }
  }

  // 7. 总字数 ≥ 1500 floor
  const total = outline.reduce((sum, s) => sum + s.estimated_words, 0);
  if (total < 1500) return reject(`总字数 ${total} 不过 1500 floor`);

  return ok();
}
```

**失败处理**: LLM 输出不通过验证 → 把 reject 原因回填进 gen_plan prompt → 重试一次 → 仍失败 → 记录 generation_runs 为 FAILED, article 状态 PLAN_INVALID, 等待人工干预。

---

## C. role_in_arc enum 扩展 (8 → 20 值)

### C.1 完整列表

```typescript
type RoleInArc =
  // 现有 8 个
  | "INTRO_PAIN"             // 引入段, 含 TL;DR 首句
  | "ANALYZE_CAUSE"          // 原因分析
  | "COMPARE_OPTIONS"        // 比较选项 (允许点名 CONTEXTUAL 类竞品)
  | "HOW_TO_STEP"            // 操作步骤 (也复用于 MIGRATION_CHECKLIST)
  | "BRIDGE_TO_PRODUCT"      // 产品桥接段 (DIRECTOR 必有)
  | "CTA"                    // 行动号召
  | "CONTEXT"                // 背景上下文
  | "CONCLUSION"             // 总结

  // 新增 12 个
  | "DEFINITION"             // 定义陈述 (learn/understand 必有)
  | "MECHANISM"              // 原理/机制
  | "REAL_USAGE"             // 实际使用场景
  | "WHEN_TO_USE_WHICH"      // 何时用哪个 (不点名竞品)
  | "SCENARIO_BREAKDOWN"     // 场景拆分
  | "COMMON_MISTAKES"        // 常见错误
  | "DECISION_FRAMEWORK"     // 决策框架 (choose 必有)
  | "DIMENSION_ANALYSIS"     // 按维度展开 (不点名)
  | "LIMITATIONS_OF_CATEGORY" // 类别局限 (批判类别不批品牌, disparagement 安全)
  | "WHY_LEAVING"            // 为什么要离开 (replace)
  | "MIGRATION_BLOCKERS"     // 迁移阻碍 (replace)
  | "FAQ"                    // 常见问题 (通用必有)
```

**总数**: 20 个值

### C.2 复用决定 (不新建的)

- **MIGRATION_CHECKLIST 复用 HOW_TO_STEP**: 写作风格相同(编号步骤), 通过 brief_hint 区分 (e.g. "迁移检查清单, 从 X 工具到 ZIXEL 的实际步骤")
- **TL;DR 不进 enum**: 作为 INTRO_PAIN 子规则, 见 §D

### C.3 每个新 role 的写作定位 (供 section prompt 参考)

| Role | 写作风格 | 长度 | 关键 prompt 指令 |
|---|---|---|---|
| DEFINITION | 短陈述, "X 是 Y" 句式 | 100-180 | 不展开, 不举例, 直接给定义。允许首句脱离上下文阅读 |
| MECHANISM | 因果/结构性说明 "怎么/为什么" | 200-300 | 解释机制, 不解释定义。可分 2-3 个机制要点 |
| REAL_USAGE | 场景叙事, 偏轶事 | 180-260 | 具体场景 + 真实做法, 不要泛泛而谈。ME × learn/understand 这里自然提及 ZIXEL 一次 |
| WHEN_TO_USE_WHICH | 比较概念/方法, 不点名品牌 | 200-300 | 给判断标准, 不要表格(留给 DIMENSION_ANALYSIS)。讨论"什么时候选 A 什么时候选 B" |
| SCENARIO_BREAKDOWN | 列举具体用户场景 | 180-280 | 3 个左右的场景, 每个场景一段。不要假设场景, 用真实可识别的 |
| COMMON_MISTAKES | 纠错性, 列错误 + 正确做法 | 150-250 | 2-3 个常见错误, 每个先说错在哪再说怎么对 |
| DECISION_FRAMEWORK | 教判断标准, 不是给答案 | 180-260 | 给读者一个框架自己判断, 不直接推荐某个产品 |
| DIMENSION_ANALYSIS | 维度展开, 表格友好, 不点名 | 200-300 | 列 3-5 个维度逐个分析, 不要把竞品名作为列标题 |
| LIMITATIONS_OF_CATEGORY | 批判类别整体, disparagement 安全 | 150-250 | 说"这类工具普遍存在的问题", 不说"X 工具有这个问题"。doc 反贬损要求的核心承载段 |
| WHY_LEAVING | 动机分析 | 150-220 | 读者为什么想换 (痛点 + 触发事件), 不批旧工具具体厂商 |
| MIGRATION_BLOCKERS | 迁移阻碍盘点 | 200-280 | 实际迁移会遇到的问题(数据格式/学习曲线/团队推动等), 给 awareness 不给安慰 |
| FAQ | Q-A 对, 每 Q 一行 + 短答 | 200-350 | 3 个真实问题(来自 SerpAPI "People Also Ask" 或类似), 每答 60-100 字。**触发 FAQPage JSON-LD schema** |

---

## D. TL;DR 处理 (作为 INTRO_PAIN 子规则)

### D.1 决定

TL;DR **不作为单独 role**, 而是 INTRO_PAIN 段的强制首句规则。

### D.2 写作规则

INTRO_PAIN 的 section prompt 加这条指令:

> 首句必须是一个**自包含的陈述句**, 直接回答关键词所问的问题。脱离上下文也能读懂。然后第二句开始转入痛点引入。
>
> 示例(关键词 "STP 文件是什么"):
> 第一句: "STP 文件是 STEP 标准格式的简写, 用于在不同 CAD 软件之间交换 3D 模型数据。"
> 第二句开始: "很多设计师在用 ZIXEL 协作时, 经常碰到团队同事用 SolidWorks 导出的文件打不开..."

### D.3 humanizer 豁免

INTRO_PAIN 段首句**豁免 humanizer rule 20** (conclusion by assertion)。陈述性首句是 AEO/GEO 必需, 不能被反 AI 规则误伤。豁免范围: 仅首句, 后续句仍受 rule 20 约束。

### D.4 为什么不单独成 role

讨论过程见本窗口对话:
- 写作模式不同(百科声调 vs 对话声调)
- 但只有 1 句, 单独成 role 浪费 LLM 调用 + 生成开销
- 作为 INTRO_PAIN 子规则更经济, 一个 prompt 处理两种声调

---

## E. CONSTRAINTS 新增 (3 条) 和 修订 (2 条)

### E.1 新增 A16 — Brand placement required

```
A16. 已发布文章正文必须含 ≥1 次 "ZIXEL" 或 "子虔" 提及
  - QC publish 阶段 code 扫描 article.body_markdown
  - 大小写不敏感, 全词匹配
  - DIRECTOR mode 因有 BRIDGE_TO_PRODUCT 段恒过
  - ME mode × learn/understand 需在 REAL_USAGE 段软植入
  - 失败 → article status = QC_FAILED, 进 Quality > Failed 等人工处理
```

### E.2 新增 A17 — No external links in body

```
A17. 文章正文禁止外站链接, 除允许域名白名单
  - 白名单: zixel3d.com / *.zixel3d.com / docs.zixel3d.com 等子域
  - QC publish 阶段 code 扫描 markdown 中 [text](url) 模式
  - 失败 → QC_FAILED
  - 锚文本对内部跳转的页面 ID 不算外链
```

### E.3 新增 A18 — No contact patterns

```
A18. 文章正文禁止以下 pattern
  - 手机号: \d{11}, +?86-?\d{11}, \d{3}-?\d{4}-?\d{4}
  - 微信号/QQ号: "微信:" / "WeChat:" / "QQ:" 后跟 ID
  - 群邀请: "加群" / "进群" / 群号 pattern
  - QR code 引用: "扫码" / "二维码" / "scan"
  - QC publish 阶段 code 扫描
  - 失败 → QC_FAILED
```

### E.4 修订 A11 (原: DIRECTOR 必有 ZIXEL 段)

**改成**:

```
A11. DIRECTOR flow 必含 BRIDGE_TO_PRODUCT role
  - gen_skeleton 验证 outline 含 BRIDGE_TO_PRODUCT role
  - 位置必须在 position N-3 或 N-2 (FAQ/CTA 之前)
  - ME flow 不强制此 role
```

### E.5 修订 A12 (字数)

**改成**:

```
A12. 段落字数遵循 role_word_targets 表, 文章总字数 ≥ 1500 floor
  - 每个段对应的 role 有 [min, max] 区间(见 inherited_rules §20)
  - gen_skeleton 验证每段 estimated_words 在区间内
  - 总字数 < 1500 拒绝 outline
  - 实际生成后 < 1500 → 触发补段(添加 1 个 typical role)或重新 gen_plan
```

---

## F. 下放 A19/A20 (本来想进 CONSTRAINTS, 改成下放)

### F.1 A19 (title 规则) → 下放到 inherited_rules §19

**写在 inherited_rules.md 新增 §19**:

```
§19 Title formation rules

19.1 Length: 10-30 字
19.2 必须含核心关键词, 位置靠前 (前 8 字内出现)
19.3 三种允许格式:
  - 单标题: "cad 是什么意思"
  - 双标题: "cad 是什么意思? CAD 有什么用?"
  - 特殊前后缀: "cad 是什么意思? 一文带你了解!"
19.4 禁止:
  - 全英文标题 (zh-CN 站)
  - 标题党 (文不对题)
  - 特殊符号 (emoji / ※ / ★ 等)
  - 错别字 (近字可)
  - 繁体字 / 生僻字
  - 低俗暴力词汇
19.5 Humanizer L1 加 rule 30 做自动检查 (见 humanizer_rules)
```

**Humanizer rule 30** (新增 L1):

```
Rule 30 (L1, code): Title compliance
- 长度 ∈ [10, 30]
- 含 core keyword
- 不含 emoji / 特殊符号
- 不全英文
- 违反 → score = 0, 文章直接 QC_FAILED
```

### F.2 A20 (disparagement-free) → 下放到 humanizer rule 28

不进 CONSTRAINTS, 作为 humanizer L2 规则 28:

```
Rule 28 (L2, LLM): Disparagement check
- 输入: 完整文章 markdown + 已知 competitor 列表
- LLM 任务: 检测任何 competitor mention 是否构成 "宣传/抨击/贬低"
- 标准: 客观陈述事实 → 通过; 评价性词汇(差/烂/不行/落后) → 不通过
- 输出: { passes: bool, violations: [{competitor, snippet, reason}] }
- 不通过 → score 扣 30, 整体 humanizer 不过
```

**理由**: 这是质量问题不是系统行为问题。CONSTRAINTS 留给"系统不变量"。

---

## G. ARCHITECTURE 修订: gen_plan 是 fork 点 (两个 mode 都消费 SERP)

### G.1 锁定

(继承 HANDOFF_v2 决定 1 和 2, 加强:)

- **fork 点**: gen_plan
- **两个 mode 都消费 `competitor_outlines`** (来自 SerpAPI gap 分析)
- **DIRECTOR 多用一个输入**: `product_features` (用来挑 thesis_feature_id)
- **ME 不需要 product_features 作为 gen_plan 输入** (但需要 ZIXEL 功能列表用于 REAL_USAGE 段的软植入, 是 gen_section 的输入)

### G.2 输入对比

```typescript
// DIRECTOR gen_plan 输入
type DirectorPlanInput = {
  keyword: string;
  intent_type: IntentType;
  competitor_outlines: CompetitorOutline[];   // SERP 前 10 抓的 H2 outline
  product_features: ProductFeature[];          // 用来挑 thesis
  forbidden_competitors: string[];             // NEVER 类竞品
};

// ME gen_plan 输入
type MePlanInput = {
  keyword: string;
  intent_type: IntentType;
  competitor_outlines: CompetitorOutline[];   // 同样消费
  forbidden_competitors: string[];
  // 不传 product_features → ME 不挑 thesis
};
```

### G.3 fork 后下游共用

- gen_skeleton: 全代码, 不分 mode
- gen_section: 共享代码, 通过 `flow_mode` 字段查 prompt set 做轻量 overlay
- gen_qc: 共享代码, ME 多一个 brand mention scan

### G.4 文件级实现

```
lib/flow/
├── shared/
│   ├── gen_skeleton.ts        # 全代码, 共用
│   ├── gen_section.ts         # 共用, 读 flow_mode 决定 prompt
│   └── gen_qc.ts              # 共用 + ME 加 scan
├── director/
│   └── gen_plan.ts            # DIRECTOR-only
└── me/
    └── gen_plan.ts            # ME-only
```

### G.5 SERP 实现路径 (W3 决定不是 spec 决定)

- Path 1 (cheap): 用 SerpAPI 返回的标题 + meta description 当 outline
- Path 2 (medium): fetch top-10 页面抓 H2 当 outline
- Path 3 (ambitious): full content extraction + LLM 分类
- 推荐: Path 2 + Path 1 fallback

---

## H. CLAUDE.md 新增

### H.1 加 "Help Don't Sell" 第三原则

(继承 Persona anchor 和 Anti-verbose rule 之外, 加第三条)

```
**Help Don't Sell pattern (从写作要求文档继承)**:

写营销段 (BRIDGE_TO_PRODUCT) 时遵循 doc 给的 pattern:

X 错误: "我们的云原生 3D CAD 软件是市面上最好的, 快来购买吧!"

✓ 正确: "在团队协作设计中, 很多人习惯通过邮件反复传输 CAD 文件, 不仅效率低, 还容易版本混乱。
       在这个案例里, 我们使用 子虔科技 ZIXEL 云原生 3D CAD 产品设计协作平台, 让设计师和工程师
       直接在云端实时协作, 所有修改自动同步, 省去了反复传文件的麻烦。如果你也想体验这种高效的
       协作方式, 可以访问 [链接]。"

核心: 先说场景痛点 → 自然带出产品 → 具体讲产品做什么 → 不卖, 邀请体验
```

### H.2 加新 anti-patterns

CLAUDE.md anti-patterns 列表追加:

- 写贬损竞品的内容(humanizer rule 28 自动拦截)
- 在 article body 加站外链接(CONSTRAINTS A17)
- 在 article body 加联系方式 pattern(CONSTRAINTS A18)
- 生成不含 ZIXEL/子虔 提及的 article(CONSTRAINTS A16)
- 写 INTRO_PAIN 首句不是独立陈述句(违反 TL;DR 规则)

---

## I. humanizer 新规则 (5 条) + 豁免 (3 条)

### I.1 新规则

| Rule # | Layer | 描述 | 实施时机 |
|---|---|---|---|
| 25 | L1 (code) | Brand mention required: body 必须含 ≥1 次 ZIXEL/子虔 | W5 前 |
| 26 | L1 (code) | No external link patterns (matched against allowlist) | W5 前 |
| 27 | L1 (code) | No contact patterns (phone/wechat/qq/qr/group) | W5 前 |
| 28 | L2 (LLM) | Disparagement check (见 §F.2) | W5 前 |
| 29 | L2 (LLM) | Information gain check: 文章至少包含 1/4 信息增益维度 | W5 前 |
| 30 | L1 (code) | Title compliance (见 §F.1) | W5 前 |

### I.2 信息增益 (rule 29) 详细

L2 LLM 检查文章是否含以下至少一项:

1. **一手经验**: 真实操作步骤 + 截图描述 + 实战错误
2. **独家数据**: 性能对比数字 / 使用统计 / 实测结果
3. **整合性洞察**: 把多个概念串联(比如建模 + 出图 + 协作 → 完整流程)
4. **可视化资产**: v1 不可达 (文章是 markdown 文本, 不生成图表), 跳过这条

→ 满足 1 或 2 或 3 之一 → 通过
→ 全部不满足 → score 扣 25, humanizer 不过

### I.3 豁免

| 段类型 | 豁免规则 |
|---|---|
| INTRO_PAIN 首句 (TL;DR) | 豁免 rule 20 (conclusion by assertion); 允许"X 是 Y"陈述 |
| FAQ section | 豁免 rule 8 (long sentence) for answers; 豁免 rule 4 (rule-of-three) when exactly 3 FAQ items |
| DEFINITION section | 豁免 rule 20 前 1-2 句; 允许陈述性首句 |

---

## J. 推迟工作清单 (按必做时机分组)

### J.1 W1 启动前必做

- [ ] **决策 4** §9 重构落到 inherited_rules.md (重写 §9 整段, 用 §B 内容替换)
- [ ] **决策 5** data_shapes.md role_in_arc enum 扩展 (8 → 20) + 更新 article_plan.suggested_outline shape
- [ ] **决策 6** DATA_MODEL.md 删 skeleton_templates 表 + 更新 article_plans 表注释指向新 outline shape
- [ ] **决策 11** ARCHITECTURE.md 文档化 gen_plan fork 点 + 两个 mode 都消费 competitor_outlines
- [ ] 写 `reference/env_vars.md`
- [ ] 写 `windows/W1.md`

### J.2 W3 启动前必做

- [ ] inherited_rules.md §18 反贬损 (从 §F.2 + 写作要求文档抽取)
- [ ] inherited_rules.md §19 title 规则 (见 §F.1)
- [ ] inherited_rules.md §20 字数表细节 (见 §B.5)
- [ ] CLAUDE.md 加 Help Don't Sell 第三原则 (见 §H.1) + anti-patterns 追加 (见 §H.2)
- [ ] CONSTRAINTS.md 新增 A16/A17/A18 (见 §E)
- [ ] CONSTRAINTS.md 修订 A11/A12 (见 §E.4/E.5)
- [ ] inherited_rules.md §16 EEAT 微调: FAQ 触发 FAQPage JSON-LD, TL;DR 句支持 AEO

### J.3 W4 启动前必做

- [ ] inherited_rules.md §21 信息增益原则 (见 §I.2)
- [ ] inherited_rules.md §22 Help Don't Sell 写作模式 (用于 BRIDGE_TO_PRODUCT prompt)
- [ ] inherited_rules.md §23 TL;DR 写作规则 (见 §D.2)
- [ ] prompts/section_intro_pain.md 加 TL;DR 子规则
- [ ] prompts/section_bridge_to_product.md 体现 Help Don't Sell

### J.4 W5 启动前必做

- [ ] humanizer_rules.md 新增 rule 25-30 (见 §I.1)
- [ ] humanizer_rules.md 新增 3 个豁免 (见 §I.3)
- [ ] prompts/qc_humanizer_l2.md 体现 rule 28 disparagement + rule 29 信息增益

### J.5 推迟到验证后再决定

- [ ] solve intent 是否要加 sub_pattern (operation vs diagnosis)
- [ ] 其他 intent 是否要加 typical_middle_roles / discouraged_roles (软引导)
- [ ] keyword pre-check SOP 是否要自动化

---

## K. 下窗口接手后第一个动作 (具体)

```markdown
1. 读本文件 + CLAUDE.md + CONSTRAINTS.md + 当前 inherited_rules.md (~600 行) + data_shapes.md (~400 行) + DATA_MODEL.md (~700 行)
2. 向用户确认: "我已读完 DECISIONS_v3, 即将改 inherited_rules.md §9, 用 role 约束表替换固定模板"
3. 开始改 inherited_rules.md §9 (按 §B 内容)
4. 改完 view 验证
5. 改 data_shapes.md role_in_arc enum + article_plan shape
6. 改 DATA_MODEL.md 删 skeleton_templates 表
7. 改 ARCHITECTURE.md fork 点描述
8. 写 reference/env_vars.md
9. 写 windows/W1.md
10. 写 HANDOFF_v4.md 给再下一个窗口
```

---

## L. 共享决策标记 (供 branch-mvp 引用)

branch-mvp 的 DECISIONS_v3.md 会引用本文件以下 sections (这些决策两条路都成立):

- §A 写作要求接收 + 三个 Conflict 解决
- §B §9 重构方向 (核心 + 通用 + Mode + Intent 简化 + 字数表 + gen_plan shape)
- §C role_in_arc enum 20 值
- §D TL;DR 处理
- §G fork 点 + SERP 两 mode 都消费
- §H.1 Help Don't Sell 原则

branch-mvp 不实施 (MVP 阶段) 的 sections:

- §E CONSTRAINTS A16/A17/A18 (MVP 不发布, 不做 publish 检查)
- §F A19/A20 下放 (MVP 不做自动 humanizer L1)
- §I humanizer rule 25-30 (MVP 用人眼 review)
- §J 所有推迟列表

---

## M. 历史背景 (供下窗口理解为什么这么定)

本窗口讨论关键转折点:

1. **写作要求文档接收 → 3 个 Conflict** (见 §A.2)
2. **enum 设计反思** (用户提出 enum 应该是 role 库不是固定模板, 我接受并重构 §9 整段)
3. **A19/A20 取舍** (用户质疑为什么进 CONSTRAINTS, 我反思后下放到 humanizer + inherited_rules)
4. **MVP 转向** (用户说"lean startup 风格 + 先把文章质量做好", 我提 MVP 提案)
5. **Branch 分裂** (用户担心交接漏掉, 决定建 branch-original + branch-mvp 两条路, 把决策落到 DECISIONS_v3 而不是直接改 spec)
6. **solve sub_pattern 缺口暴露** (用户问"操作性 solve 怎么办", 我意识到 5 个 intent 粒度不够, 锁定路径 1 推迟决定)
7. **质量迭代重心确认** (用户纠正: 项目核心是围绕 MVP 反复迭代直到文章质量稳定, 不是"验证一次就工程化")

---

## N. 本窗口讨论过程详录 (防遗失, 下窗口理解决策的 why)

> 前面 §A-§M 写的是**决策结果**。本节补**讨论过程**, 让下窗口理解为什么这么定, 避免重新推翻。

### N.1 §9 约束表的三层讨论 (step 1/2/3)

约束表是分三层逐步锁定的, 顺序不能乱:

**Step 1 — universal 约束 (所有 mode/intent 共用)**: 见 §B.2。关键点是 min/max 段数 (5-9)、INTRO_PAIN 必首、FAQ 必有、FAQ/CTA 收尾。讨论中确认 FAQ 通用必有是为了 AEO + GEO (见 §N.4)。

**Step 2 — mode 约束 (DIRECTOR vs ME)**: 见 §B.3。关键点是 DIRECTOR 强制 BRIDGE_TO_PRODUCT + CTA, ME 禁 CTA、软 brand mention。讨论中确认 ME 的 BRIDGE_TO_PRODUCT **不进 forbidden** (某些 intent 用得上, 只是不强制), 只有 CTA 进 ME forbidden。

**Step 3 — intent 约束 (5 个 intent_type)**: 见 §B.4。**这一步暴露了核心设计缺口**, 见 §N.2。讨论中我原本设计了 typical_middle_roles + discouraged_roles 两个字段做软引导, 但用户指出 solve 有子类型问题后, **锁定推迟这两个字段**, 只保留 forbidden + required, 让 LLM 在 gen_plan 自由发挥。

### N.2 solve 子类型缺口 (operation vs diagnosis) — 重要

用户在 step 3 问 "对于操作性的 solve 要怎么做"。我承认原设计没充分考虑。

**问题**: `solve` 这个 intent 实际覆盖两个差异巨大的子类型:

- **操作指导型 solve**: 关键词如 "dwg 文件打不开怎么办"。读者要照着做能解决。结构应该是 INTRO → HOW_TO_STEP (主角, 可能 500-800 字) → COMMON_MISTAKES → FAQ。
- **诊断分析型 solve**: 关键词如 "CAD 卡顿是什么原因"。读者要先理解问题在哪。结构应该是 INTRO → ANALYZE_CAUSE → SCENARIO_BREAKDOWN → HOW_TO_STEP (配角, 针对每个 case 给对策) → FAQ。

两类用同一套 role 组合和字数表会产出明显差的结果。

**类似问题在其他 intent 也存在**:
- `learn`: 词汇定义 ("STP 是什么") vs 系统理解 ("CAD 工作原理")
- `choose`: 免费选型 vs 企业级选型
- `replace`: 探索替代品 (还在比较) vs 已决定迁移 (在做迁移)

**两条处理路径**:
- 路径 1 (推迟): v1 不区分, LLM 在 gen_plan 自由发挥, 跑出来看质量再决定是否加 sub_pattern
- 路径 2 (现在加): keyword_intents 表加 sub_pattern 字段, 约束表按 (intent, sub_pattern) 两轴设计

**本窗口锁定路径 1**。理由: 不验证质量先细分 = 过早优化。加 sub_pattern 是数据结构改动, 加进去再去掉很麻烦; 不加反而容易后补。

**⚠️ 下窗口注意**: 跑 MVP 时**优先选 solve operation 类关键词** (如 "dwg 文件打不开怎么办"), 因为这是最能暴露子类型问题的 intent。如果 LLM 自由发挥的结构不对头, 就是要加 sub_pattern 的信号。

### N.3 role_in_arc 12 个新值的对照分析 (为什么新增不复用)

判断标准: **section prompt 是否需要为这个 role 写不同的指令**。如果写法跟现有 role 一样, 就复用 + brief_hint; 不一样才新增。

| 新 role | 为什么不复用现有的 |
|---|---|
| DEFINITION | "X 是 Y" 短陈述, 跟 CONTEXT (背景铺陈) 写法不同 |
| MECHANISM | 讲"怎么/为什么", 跟 CONTEXT (讲"是什么") 不同 |
| REAL_USAGE | 场景叙事偏轶事, 跟 CONTEXT 的说明文体不同 |
| WHEN_TO_USE_WHICH | 比较概念但**不点名竞品**, 跟 COMPARE_OPTIONS (点名 CONTEXTUAL 竞品) 不同 |
| SCENARIO_BREAKDOWN | 列举具体场景, 跟 CONTEXT (泛背景) 不同 |
| COMMON_MISTAKES | 纠错文体, 跟 ANALYZE_CAUSE (找原因) 不同 |
| DECISION_FRAMEWORK | 教判断标准, 跟 COMPARE_OPTIONS (给比较结果) 不同 |
| DIMENSION_ANALYSIS | 按维度展开但**不点名竞品**, 跟 COMPARE_OPTIONS 的竞品规则冲突, 必须分开 |
| LIMITATIONS_OF_CATEGORY | 批判类别不批品牌 (disparagement 安全), 是写作要求文档反贬损规则的核心承载 role |
| WHY_LEAVING | 讲换工具动机, 跟 INTRO_PAIN (讲问题) 框架不同 |
| MIGRATION_BLOCKERS | 讲迁移阻碍, 跟 ANALYZE_CAUSE (讲问题原因) 不同 |
| FAQ | Q-A 格式完全不同 |

**复用的 (不新增)**:
- MIGRATION_CHECKLIST → 复用 HOW_TO_STEP + brief_hint (写法相同, 都是编号步骤)

### N.4 AEO/GEO 写作策略 (用户明确要求 ME 也要有)

用户原话: "我的那个 me 版本需要能够有 SEO 和 AEO 和 GEO 的能力 SEO 是为了收录 AEO 和 GEO 是为了曝光"。

三个概念落到文章结构:

| 缩写 | 优化目标 | 文章里怎么实现 |
|---|---|---|
| SEO | Baidu/Google 排名 (收录) | 标题含关键词 + 结构化 HTML + 内链 + 字数 — 现有 spec 已覆盖 |
| AEO | Answer Engine (Featured Snippet / 答题框 / 语音助手) — 曝光 | FAQ section (真 Q-A) + INTRO_PAIN 首句 TL;DR (一句话直接答关键词) + FAQPage JSON-LD |
| GEO | Generative Engine (被 ChatGPT/Claude/Perplexity/豆包引用) — 曝光 | 独立可解析的事实句 + 具体数字/功能名 (humanizer rule 19) + 每段一个可引用的陈述句 |

**关键洞察**: GEO 和 ME mode 的现有 voice anchor 互相强化。ME 已经要求"给数字、给版本、给具体、承认局限" — 这正是让内容 GEO 友好的特质。所以 GEO 不需要 ME 单独的写作风格, 只需要**结构性启用** (TL;DR + FAQ + 独立事实句)。

**实现**:
- TL;DR → INTRO_PAIN 子规则 (见 §D), 两个 mode 都加
- FAQ → 通用必有 (见 §B.2), 两个 mode 都加
- 独立事实句 → DEFINITION/MECHANISM 等 role 的 prompt 天然产出

### N.5 TL;DR 不进 enum 的决策过程

讨论中考虑过两种方案:
- 方案 a: TL_DR 作为独立 role_in_arc 值, 独立 section
- 方案 b: TL;DR 作为 INTRO_PAIN 的首句子规则

**锁定方案 b**。理由:
- TL;DR 只有 1 句, 独立成 section + 独立 generation_run 浪费 LLM 调用
- 写作模式确实不同 (百科声调 vs 对话声调), 但一个 INTRO_PAIN prompt 可以处理两种声调 (首句陈述 + 后续对话)
- 不进 enum 保持 enum 干净, 段数不膨胀

humanizer 豁免: INTRO_PAIN 首句豁免 rule 20 (conclusion by assertion), 仅首句, 后续句仍受约束。见 §I.3。

### N.6 三个 Conflict 的选择理由

- **Conflict 1 字数**: 选"保留 1500 floor, doc 数字当每段 minimum"。理由: 长内容对 SEO 一直是操作假设, doc 的 700-1450 是下限不是上限。
- **Conflict 2 ME brand placement**: 选"软读, body 含 ≥1 次 ZIXEL/子虔即可"。理由: 既满足 doc 的品牌植入硬要求, 又不破坏 ME 在 learn/understand 跳过 BRIDGE_TO_PRODUCT 段的设计。
- **Conflict 3 keyword 预选**: 选"v1 manual"。理由: Baidu SERP 预审是人工 SOP, 自动化是 v2 的事, 现在加只增复杂度。

### N.7 信息增益 — ZIXEL 当前能落地哪几种

写作要求文档给了 4 种信息增益方式。ZIXEL 当前现实:

| 方式 | ZIXEL v1 可行性 |
|---|---|
| 一手经验 (真实操作截图 + 实战错误) | ⚠️ 部分 — 文章是 markdown 不含截图, 但可以写真实操作步骤文字 |
| 独家数据 (使用统计/性能对比) | ❌ 用户说过没有这类数据 |
| 整合性洞察 (串联多个概念成更高层理解) | ✅ **当前唯一能稳定做的** — gen_plan 的 differentiation_strategy 字段就是干这个 |
| 可视化资产 (流程图/结构图/信息图) | ❌ v1 文章是纯文本, 不生成图 |

**结论**: 信息增益 (humanizer rule 29) 在 v1 主要靠**整合性洞察**。LLM 在 gen_plan 阶段用 differentiation_strategy = DEPTH 或 ANGLE_GAP 时, 就是在做整合性洞察。rule 29 检查时, 满足整合性洞察一条即可通过, 不强求一手经验/独家数据 (因为做不到)。

---

## O. 前面 spec 里的未结论项 (本窗口扫描, 下窗口注意)

> 用户提醒: "前面的 spec 里我们说我们需要讨论的也需要注意"。本节扫描现有 spec 文件里标记"待讨论/待定"但本窗口未解决的项。

### O.1 来自 HANDOFF.md / HANDOFF_v2.md 的待讨论项

| 来源 | 待讨论项 | 当前状态 |
|---|---|---|
| HANDOFF.md 待讨论 1 | Skeleton 段数扩展 (6 → 8-10 段) | ✅ **本窗口已解决** — §9 重构成 role 库 + 约束表, 段数变成 5-9 可变 |
| HANDOFF.md 待讨论 2 | EEAT 具体实施 (更新时间位置 / JSON-LD 字段 / Storyblok metadata) | ⚠️ **部分** — inherited_rules §16 定了大方向 (timestamp 顶部、Article+FAQPage JSON-LD、W4/W5 实施), 但**三个精确细节仍未定**, 见 O.3 |
| HANDOFF_v2.md 决定 2 尾巴 | DIRECTOR vs ME 的 gen_plan 输入是否完全一致 | ⚠️ **部分** — §G.2 定了 ME 不传 product_features, 但 SERP gap 输入是否两边格式完全一致**未细化**, 见 O.3 |

### O.2 来自 inherited_rules.md 的状态

| Section | 状态 |
|---|---|
| §16 EEAT | ✅ 大部分 decided。仅 O.3 列的三个 timestamp/JSON-LD 细节待定 |
| §17 Persona / addressing | ✅ 完全 decided, 无未结论 |
| §1-§15 | ✅ 已 inherited 锁定, 本窗口不动 |

### O.3 仍未结论、留给后续窗口讨论的项 (明确清单)

1. **EEAT timestamp 精确位置**: 顶部 H1 之后? INTRO 之前? — §16 说"顶部"但没说精确位置。**W4 assemble 阶段实施前要定**。
2. **schema.org JSON-LD 具体字段**: Article 标准字段 (headline/datePublished/author/...) + FAQPage 字段 (mainEntity/Question/Answer) 的精确 schema。**W5 实施前要定**。
3. **Storyblok metadata 传哪些**: 推送时除文章 body 外还传哪些字段。**W5 飞书/Storyblok 集成前要定**。
4. **DIRECTOR vs ME 的 SERP 输入格式**: 两个 mode 的 competitor_outlines 输入是否完全一致 (字段、深度)。**W3 gen_plan 实施前要定**。
5. **solve sub_pattern**: 是否加 operation/diagnosis 区分。**等 MVP/W3 验证后定** (见 N.2)。
6. **typical_middle_roles / discouraged_roles**: 是否加软引导字段。**等 MVP/W3 验证后定** (见 N.1)。
7. **keyword 预选 SOP 自动化**: v2 再说。

### O.4 CONSTRAINTS / CLAUDE 待落地修订 (本窗口锁定方向, 下窗口改文件)

| 文件 | 修订 | 状态 | 在本文件哪里 |
|---|---|---|---|
| CONSTRAINTS.md | A11 (DIRECTOR 必有 ZIXEL 段 → BRIDGE_TO_PRODUCT role) | 🔵 方向锁定 | §E.4 |
| CONSTRAINTS.md | A12 (字数 → role table + 1500 floor) | 🔵 方向锁定 | §E.5 |
| CONSTRAINTS.md | A16/A17/A18 新增 | 🔵 方向锁定 | §E.1/E.2/E.3 |
| CLAUDE.md | Help Don't Sell 第三原则 | 🔵 方向锁定 | §H.1 |
| CLAUDE.md | anti-patterns 追加 | 🔵 方向锁定 | §H.2 |

---

**END of DECISIONS_v3 (branch-original)**
