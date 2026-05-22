# inherited_rules.md — Content rules and seed data

> All inherited content rules, regex patterns, fixed text, enums, and seed data. Source of truth for `prompts/`, `lib/humanizer/`, `lib/flow/`, and DB seed scripts.

---

## 1. Persona anchor (verbatim, do not paraphrase)

This goes into **every** section prompt, both flow modes:

> 子虔小编是一个真正用过 CAD 的人,在跟另一个用 CAD 的人说一件有用的事。

Both DIRECTOR and ME mode use this anchor. Do not modify wording.

补充: 论述中故意打破的"活人感"技巧 (重复强调 / 中途打断 / 省略主语 / 刻意模糊) 见 `reference/kazik_adaptation.md §1.4`。

---

## 2. Anti-verbose rule (verbatim)

This goes into every section prompt:

> 每段只说一件事,说完就停。出现「另外」「此外」「同时」「还有」说明在用一段说两件事,必须拆开或删掉其中一个。如果一句话删掉后意思没变,就删掉它。

补充: 节奏规则 (长短句交替 / 一句话独立成段制造断裂 / 扣主线句) 见 `reference/kazik_adaptation.md §1.3`。

---

## 3. Positive style anchors

### 3.1 ME mode style anchor (full version)

> 直白,不绕弯。一句话一件事,事情说清楚就停。不堆形容词,不用"高效便捷"这种没信息的词。该具体就具体——给数字,给步骤,给具体软件版本。该承认局限就承认——某个情况下我们的方案不合适,直接说,不掩饰。读起来要像一个工程师在 IM 里跟同事讲一件事,不是一个销售在路演。

### 3.2 DIRECTOR mode style anchor (limitations-admission line removed)

> 直白,不绕弯。一句话一件事,事情说清楚就停。不堆形容词,不用"高效便捷"这种没信息的词。该具体就具体——给数字,给步骤,给具体软件版本。读起来要像一个工程师在 IM 里跟同事讲一件事。

Director mode preserves engineer voice but drops the "admit our solution doesn't fit sometimes" line, since DIRECTOR mode pushes the product confidently.

补充: 活人感测试 (体感记忆 vs 知识性描述, 例如 "愣住了" 替代 "很震撼") 见 `reference/kazik_adaptation.md §1.5`。推荐口语化词组的 SEO 适配子集 (剔除公众号 IP 味, 保留工程师姿态适用的) 见 `reference/kazik_adaptation.md §1.6`。

---

## 4. Five intent_types (definitions)

| Code | Name | What user wants | Example keyword |
|---|---|---|---|
| `learn` | 学习概念 | Understand what something is | `STP文件是什么` / `云原生CAD是什么` |
| `solve` | 解决问题 | Fix a specific blocked situation | `dwg打不开` / `SolidWorks卡顿` |
| `choose` | 做选型 | Pick from options before buying/using | `免费CAD推荐` / `2026最佳CAD` |
| `replace` | 换工具 | Replace current tool | `AutoCAD替代` / `中望转ZIXEL` |
| `understand` | 区分概念 | Distinguish similar concepts | `DWG和DXF区别` / `STP和STEP差别` |

Disambiguation rules (apply in this priority):
1. If keyword contains explicit "vs / 区别 / 差别 / 对比 X 和 Y" → `understand`
2. If keyword contains "替代 / 替换 / 平替 / 换" + product name → `replace`
3. If keyword contains "推荐 / 排行 / 最佳 / 好用的 / 哪个" → `choose`
4. If keyword contains "怎么办 / 不能 / 失败 / 报错 / 打不开 / 卡顿 / 慢" → `solve`
5. Else → `learn`

---

## 5. Ten roles (fixed enum)

```
机械工程师
结构工程师
ID工程师
工艺工程师
售前/售后工程师
研发负责人/管理层
项目经理
采购/IT/数字化
学生/教师
创客/自由职业者
```

These map to user identities. Used in `keyword_intents.role` for routing/analytics, **never** injected into the section prompt (would produce "对于结构工程师来说..." AI-flyer voice).

Exception: when `intent_type IN ('choose', 'replace')`, role MAY be referenced in the plan prompt because decision-makers need audience-aware framing. Even then, section prompt does not see it directly.

---

## 6. Ten categories (fixed enum)

Maps to URL paths on zixel3d.com:

| Category | URL path |
|---|---|
| `CAD文件` | `https://www.zixel3d.com/cad-faqs/files` |
| `CAD常见问题` | `https://www.zixel3d.com/cad-faqs/faq` |
| `CAD名词解释` | `https://www.zixel3d.com/cad-faqs/glossary` |
| `CAD协作` | `https://www.zixel3d.com/cad-faqs/collaboration` |
| `CAD建模` | `https://www.zixel3d.com/cad-faqs/3d` |
| `CAD行业观察` | `https://www.zixel3d.com/cad-faqs/industry` |
| `CAD快捷键` | `https://www.zixel3d.com/cad-faqs/shortcuts` |
| `CAD工程图` | `https://www.zixel3d.com/cad-faqs/drawings` |
| `CAD集成应用` | `https://www.zixel3d.com/cad-faqs/integration` |
| `CAD产品资讯` | `https://www.zixel3d.com/cad-faqs/product` |

LLM must pick from this list verbatim. No new categories. Code-level fallback: if LLM returns invalid value, default by intent_type:
- `learn` / `understand` → `CAD名词解释`
- `solve` → `CAD常见问题`
- `choose` → `CAD产品资讯`
- `replace` → `CAD产品资讯`

---

## 7. ZIXEL product seed data

Source: user-provided `Function 功能 产品介绍.md`. 5 products, each with multiple features.

### 7.1 `products` table seed

| name | description | is_default | sort_order |
|---|---|---|---|
| 子虔科技平台 | 面向制造业的新一代工业研发协同平台,围绕"建模型、看模型、管模型、用模型"四个关键环节构建一体化平台 | true | 0 |
| 云原生3D CAD | 云原生架构的三维 CAD 设计工具 | false | 1 |
| 3D一览通 | 在线 CAD 模型与图纸查看协作工具 | false | 2 |
| PDM | 产品研发数据与流程管理平台 | false | 3 |
| 3D工艺大师 | 基于 CAD 数据生成工艺文档与交付物 | false | 4 |
| 几何搜索 | 多维度模型检索与 AI 辅助设计 | false | 5 |

### 7.2 `product_features` table seed

(All `is_unique: false` initially — user can edit and mark uniques later. `priority` set based on how product-focused content uses them.)

#### 云原生3D CAD (product)

| feature_name | description | value_proposition | priority |
|---|---|---|---|
| 云原生架构与自研核心 | 基于云原生架构与自研核心打造的三维 CAD 平台,支持草图、零件、装配、工程图基础模块 | 无需依赖外部内核,核心自主可控 | LEAD |
| 免安装 Web 设计 | 无需本地安装,通过浏览器即可访问和编辑设计文件 | 降低使用门槛、跨设备使用 | LEAD |
| 多端支持与灵活部署 | 支持 PC、移动端、私有化部署多种使用方式 | 灵活适配不同企业 IT 环境 | NORMAL |
| 云端版本管理 | 设计文件版本由云端统一管理,可随时回溯到历史版本 | 避免版本混乱、丢稿 | LEAD |
| 实时协同设计 | 多人可同时在线编辑同一设计文件,修改实时同步 | 多人设计、设计共享更高效 | LEAD |
| AI 与参数化设计 | 结合 AI 与参数化设计能力,可自然语言驱动参数化模型生成 | 加快复杂建模和设计表达 | NORMAL |
| 工程图模块 | 支持工程图的创建与维护 | 设计与出图一体化 | NORMAL |

#### 3D一览通 (product)

| feature_name | description | value_proposition | priority |
|---|---|---|---|
| 50+ 格式兼容 | 兼容 50+ 主流 CAD 文件格式(DWG/DXF/STP/STEP/IGES/OBJ/SLDPRT/SLDASM/3DM 等) | 不论上下游用什么软件都能打开 | LEAD |
| 免安装浏览器查看 | 无需安装即可在浏览器中查看 3D 模型与 2D 图纸 | 即开即用,无硬件门槛 | LEAD |
| 实时批注与评论 | 多人在同一模型上同步批注、评论、测量 | 评审从来回发文件变成围绕模型在线协作 | LEAD |
| 测量与剖切 | 支持测量、剖切、爆炸图 | 远程也能完成评审操作 | NORMAL |
| PMI 展示与属性查看 | 支持 PMI(产品制造信息)展示、模型结构树与属性查看 | 制造端能看到完整设计意图 | NORMAL |
| 权限管理 | 文件级、模型级权限控制 | 保护图纸不外泄 | NORMAL |
| SDK 集成 | 提供 SDK 可嵌入 PLM/MES/钉钉/飞书等业务系统 | 与企业现有系统对接 | NORMAL |
| 私有化部署 | 支持私有化部署,避免图纸泄露风险 | 数据安全可控 | NORMAL |

#### PDM (product)

| feature_name | description | value_proposition | priority |
|---|---|---|---|
| 图文档集中存储 | 统一管理产品全生命周期的图纸、文档与文件 | 消灭信息孤岛 | LEAD |
| BOM 管理 | 支持 BOM 创建、版本控制、变更追溯 | BOM 与设计同步,变更可追溯 | LEAD |
| 版本控制 | 自动记录每次修改并支持版本对比、回滚 | 变更可追溯、可回滚 | NORMAL |
| 权限管理 | 细粒度权限分配 | 数据安全可控 | NORMAL |
| 任务分派与进度跟踪 | 任务可分派到人、可跟踪进度 | 研发任务有人管、有结果 | NORMAL |
| 项目看板 | 项目级看板可视化进度 | 项目透明度提升 | NORMAL |
| 流程驱动协同 | 让研发流程从文件驱动走向流程驱动 | 减少沟通断层 | LEAD |

#### 3D工艺大师 (product)

| feature_name | description | value_proposition | priority |
|---|---|---|---|
| 直接复用 CAD 数据 | 直接基于 CAD 源数据生成工艺文档,无需重复建模 | 工艺与设计同源,变更同步 | LEAD |
| 用户手册生成 | 自动生成用户手册、维修手册、装配说明 | 工艺文档输出周期大幅缩短 | NORMAL |
| 技术插图与交互动画 | 生成技术插图、交互动画、3D 工艺卡片 | 交付物更丰富、更直观 | NORMAL |
| PMI/BOM 信息接入 | PMI 与 BOM 信息可直接接入工艺文档 | 工艺信息完整、规范 | NORMAL |
| 设计变更实时同步 | 设计变更可实时同步到工艺文档 | 工艺维护成本降低 | LEAD |
| AI 拆解与动画脚本 | AI 可生成驱动 3D 拆解与动画的脚本 | 推动工艺数字化迈向智能化 | NORMAL |

#### 几何搜索 (product)

| feature_name | description | value_proposition | priority |
|---|---|---|---|
| 3D 形状搜索 | 按 3D 形状特征搜索相似模型 | 快速定位历史零部件 | LEAD |
| 图片搜索 | 按图片(2D 或 3D 渲染图)搜索模型 | 凭直觉就能查到模型 | NORMAL |
| 文本与颜色搜索 | 按文本描述或颜色检索模型 | 多种检索维度灵活组合 | NORMAL |
| 综合条件搜索 | 多条件组合检索 | 复杂查询场景适用 | NORMAL |
| 自然语言驱动参数化生成 | 自然语言指令驱动参数化模型生成 | 重复建模工作量减少 | NORMAL |
| 知识图谱与参数化逻辑 | 系统通过知识图谱理解设计需求与参数关系 | 让 AI 真正参与设计 | FALLBACK |

#### 子虔科技平台 (umbrella product)

| feature_name | description | value_proposition | priority |
|---|---|---|---|
| 一体化研发协同平台 | CAD/PDM/3D一览通/3D工艺大师/几何搜索五大模块组成的一体化平台 | 不是增加一个工具,而是重构研发协作方式 | LEAD |
| 建模/看模/管模/用模闭环 | 围绕设计、查看、管理、复用模型四个环节构建闭环 | 模型从设计文件升级为可协同/可管理/可复用/可交付的数字资产 | LEAD |
| 行业聚焦制造业 | 面向制造业、航空航天、机器人、工业自动化行业 | 行业理解深入,场景匹配 | NORMAL |
| 自主可控 | 基于自研核心 | 不依赖外部内核,核心可控 | NORMAL |

---

## 8. CTA fixed templates

`gen_section` does **not** call LLM for CTA. Code composes from template by `category`.

Template structure:
```
如果你想了解更多 [{{ category_zh }}](https://www.zixel3d.com/cad-faqs/{{ slug }}) 相关知识,请关注子虔科技 [子虔Zixel](https://www.zixel3d.com/) 了解更多。
```

Mapping:
| Category | Slug |
|---|---|
| CAD文件 | files |
| CAD常见问题 | faq |
| CAD名词解释 | glossary |
| CAD协作 | collaboration |
| CAD建模 | 3d |
| CAD行业观察 | industry |
| CAD快捷键 | shortcuts |
| CAD工程图 | drawings |
| CAD集成应用 | integration |
| CAD产品资讯 | product |

Length: 30-50 字, one paragraph, no bold.

---

## 9. Skeleton templates (10 rows for `skeleton_templates` seed)

Format: `intent_type` × `flow_mode` = 5 × 2 = 10 default templates.

Section object shape:
```typescript
{
  tag: 'INTRO' | 'H2' | 'H3' | 'STEPS' | 'ZIXEL' | 'CTA',
  title: string | null,        // null = LLM generates
  brief_hint: string | null,   // null = LLM generates from context
  role_in_arc: RoleInArc,
  requires_feature_id: boolean,
  word_target: string          // e.g. "150-200字"
}
```

### 9.1 `solve` × DIRECTOR (6 sections, mandatory ZIXEL)
```json
[
  { "tag":"INTRO", "title":"前言", "brief_hint":"点出用户面临的具体操作痛点,不说解法", "role_in_arc":"INTRO_PAIN", "requires_feature_id":false, "word_target":"100-150字" },
  { "tag":"H2", "title":null, "brief_hint":"为什么会出现这个问题,根本原因", "role_in_arc":"ANALYZE_CAUSE", "requires_feature_id":false, "word_target":"150-200字" },
  { "tag":"H2", "title":null, "brief_hint":"现有方法的局限和麻烦", "role_in_arc":"COMPARE_OPTIONS", "requires_feature_id":false, "word_target":"150-200字" },
  { "tag":"STEPS", "title":null, "brief_hint":"用 ZIXEL 产品解决这个问题的具体步骤", "role_in_arc":"HOW_TO_STEP", "requires_feature_id":true, "word_target":"150-200字" },
  { "tag":"ZIXEL", "title":null, "brief_hint":"本文场景下选 ZIXEL 的核心优势", "role_in_arc":"BRIDGE_TO_PRODUCT", "requires_feature_id":true, "word_target":"150-200字" },
  { "tag":"CTA", "title":"CTA", "brief_hint":null, "role_in_arc":"CTA", "requires_feature_id":false, "word_target":"30-50字" }
]
```

### 9.2 `solve` × ME (6 sections, ZIXEL section softer)
Same structure as DIRECTOR, but section prompt overlay differs (see `lib/flow/me/section-prompt-overlay.ts`). ZIXEL section length 100-150字 instead of 150-200字.

### 9.3 `learn` × DIRECTOR (6 sections)
```json
[
  { "tag":"INTRO", "title":"前言", "brief_hint":"点出读者对这个概念的困惑或使用需求", "role_in_arc":"INTRO_PAIN", "requires_feature_id":false, "word_target":"100-150字" },
  { "tag":"H2", "title":null, "brief_hint":"这个概念是什么,只说定义和核心特征", "role_in_arc":"CONTEXT", "requires_feature_id":false, "word_target":"150-200字" },
  { "tag":"H2", "title":null, "brief_hint":"实际使用中常见的问题或误区", "role_in_arc":"ANALYZE_CAUSE", "requires_feature_id":false, "word_target":"150-200字" },
  { "tag":"H2", "title":null, "brief_hint":"传统工具在这个场景下的局限", "role_in_arc":"COMPARE_OPTIONS", "requires_feature_id":false, "word_target":"150-200字" },
  { "tag":"ZIXEL", "title":null, "brief_hint":"推荐 ZIXEL,说明它如何解决上文局限", "role_in_arc":"BRIDGE_TO_PRODUCT", "requires_feature_id":true, "word_target":"150-200字" },
  { "tag":"CTA", "title":"CTA", "brief_hint":null, "role_in_arc":"CTA", "requires_feature_id":false, "word_target":"30-50字" }
]
```

### 9.4 `learn` × ME (5 sections, ZIXEL OMITTED)
```json
[
  { "tag":"INTRO", "title":"前言", "brief_hint":"点出读者对这个概念的困惑或使用需求", "role_in_arc":"INTRO_PAIN", "requires_feature_id":false, "word_target":"100-150字" },
  { "tag":"H2", "title":null, "brief_hint":"这个概念是什么,只说定义和核心特征", "role_in_arc":"CONTEXT", "requires_feature_id":false, "word_target":"200-250字" },
  { "tag":"H2", "title":null, "brief_hint":"实际使用中常见的问题或误区", "role_in_arc":"ANALYZE_CAUSE", "requires_feature_id":false, "word_target":"200-250字" },
  { "tag":"H2", "title":null, "brief_hint":"如何处理或选择(可一句话顺带提及 ZIXEL,不展开)", "role_in_arc":"COMPARE_OPTIONS", "requires_feature_id":false, "word_target":"200-250字" },
  { "tag":"CTA", "title":"CTA", "brief_hint":null, "role_in_arc":"CTA", "requires_feature_id":false, "word_target":"30-50字" }
]
```

### 9.5 `understand` × DIRECTOR (6 sections)
```json
[
  { "tag":"INTRO", "title":"前言", "brief_hint":"点出读者想弄清楚的差异或原理", "role_in_arc":"INTRO_PAIN", "requires_feature_id":false, "word_target":"100-150字" },
  { "tag":"H2", "title":null, "brief_hint":"概念A或差异的第一面", "role_in_arc":"CONTEXT", "requires_feature_id":false, "word_target":"150-200字" },
  { "tag":"H2", "title":null, "brief_hint":"概念B或差异的第二面,和上段形成对比", "role_in_arc":"CONTEXT", "requires_feature_id":false, "word_target":"150-200字" },
  { "tag":"H2", "title":null, "brief_hint":"传统工具在这个场景下的局限", "role_in_arc":"COMPARE_OPTIONS", "requires_feature_id":false, "word_target":"150-200字" },
  { "tag":"ZIXEL", "title":null, "brief_hint":"推荐 ZIXEL,说明它如何解决上文局限", "role_in_arc":"BRIDGE_TO_PRODUCT", "requires_feature_id":true, "word_target":"150-200字" },
  { "tag":"CTA", "title":"CTA", "brief_hint":null, "role_in_arc":"CTA", "requires_feature_id":false, "word_target":"30-50字" }
]
```

### 9.6 `understand` × ME (5 sections, ZIXEL OMITTED)
```json
[
  { "tag":"INTRO", "title":"前言", "brief_hint":"点出读者想弄清楚的差异或原理", "role_in_arc":"INTRO_PAIN", "requires_feature_id":false, "word_target":"100-150字" },
  { "tag":"H2", "title":null, "brief_hint":"概念A或差异的第一面", "role_in_arc":"CONTEXT", "requires_feature_id":false, "word_target":"200-250字" },
  { "tag":"H2", "title":null, "brief_hint":"概念B或差异的第二面,和上段形成对比", "role_in_arc":"CONTEXT", "requires_feature_id":false, "word_target":"200-250字" },
  { "tag":"H2", "title":null, "brief_hint":"实际场景下选哪个或注意什么(自然提及 ZIXEL,不展开)", "role_in_arc":"COMPARE_OPTIONS", "requires_feature_id":false, "word_target":"200-250字" },
  { "tag":"CTA", "title":"CTA", "brief_hint":null, "role_in_arc":"CTA", "requires_feature_id":false, "word_target":"30-50字" }
]
```

### 9.7 `choose` × DIRECTOR (6 sections, ZIXEL prominent)
```json
[
  { "tag":"INTRO", "title":"前言", "brief_hint":"点出选型场景下读者的困惑", "role_in_arc":"INTRO_PAIN", "requires_feature_id":false, "word_target":"100-150字" },
  { "tag":"H2", "title":null, "brief_hint":"帮读者建立选型判断框架", "role_in_arc":"CONTEXT", "requires_feature_id":false, "word_target":"150-200字" },
  { "tag":"H2", "title":null, "brief_hint":"介绍竞品,只一两句客观描述,不展开", "role_in_arc":"COMPARE_OPTIONS", "requires_feature_id":false, "word_target":"150-200字" },
  { "tag":"H2", "title":"传统CAD软件的局限性", "brief_hint":"总结这类工具的共同局限,引出 ZIXEL", "role_in_arc":"ANALYZE_CAUSE", "requires_feature_id":false, "word_target":"150-200字" },
  { "tag":"ZIXEL", "title":null, "brief_hint":"推荐 ZIXEL,说明它如何解决选型痛点", "role_in_arc":"BRIDGE_TO_PRODUCT", "requires_feature_id":true, "word_target":"150-200字" },
  { "tag":"CTA", "title":"CTA", "brief_hint":null, "role_in_arc":"CTA", "requires_feature_id":false, "word_target":"30-50字" }
]
```

### 9.8 `choose` × ME (6 sections, ZIXEL kept but softer)
Same structure as DIRECTOR. ME mode keeps the ZIXEL section because `choose` intent inherently is product-comparison. Difference is in section prompt overlay (more balanced framing, willingness to note ZIXEL's limitations).

### 9.9 `replace` × DIRECTOR (6 sections)
```json
[
  { "tag":"INTRO", "title":"前言", "brief_hint":"点出用户想替换现有软件的原因", "role_in_arc":"INTRO_PAIN", "requires_feature_id":false, "word_target":"100-150字" },
  { "tag":"H2", "title":null, "brief_hint":"现有工具哪里不够用,为什么要换", "role_in_arc":"ANALYZE_CAUSE", "requires_feature_id":false, "word_target":"150-200字" },
  { "tag":"H2", "title":null, "brief_hint":"介绍竞品,只一两句客观描述,不展开", "role_in_arc":"COMPARE_OPTIONS", "requires_feature_id":false, "word_target":"150-200字" },
  { "tag":"H2", "title":"传统CAD软件的局限性", "brief_hint":"总结这类工具的共同局限,引出 ZIXEL", "role_in_arc":"ANALYZE_CAUSE", "requires_feature_id":false, "word_target":"150-200字" },
  { "tag":"ZIXEL", "title":null, "brief_hint":"推荐 ZIXEL 作为替代方案,聚焦迁移优势", "role_in_arc":"BRIDGE_TO_PRODUCT", "requires_feature_id":true, "word_target":"150-200字" },
  { "tag":"CTA", "title":"CTA", "brief_hint":null, "role_in_arc":"CTA", "requires_feature_id":false, "word_target":"30-50字" }
]
```

### 9.10 `replace` × ME (6 sections)
Same structure as DIRECTOR. Section prompt overlay tones down "everyone should switch", admits there are cases where users should keep current tool.

---

## 10. Competitor mention rules (from previous `buildCompetitorRule`)

By `intent_type`:

| intent_type | Rule for competitor names in article body |
|---|---|
| `solve` | **FORBIDDEN** in all sections. Article focuses on ZIXEL solving the problem. |
| `learn` | **FORBIDDEN** in all sections. Article focuses on concept + ZIXEL solution. |
| `understand` | **FORBIDDEN** in all sections. Article distinguishes concepts, not products. |
| `choose` | Allowed **only** in sections with `role_in_arc = COMPARE_OPTIONS`. Other sections: forbidden. |
| `replace` | Allowed **only** in sections with `role_in_arc = COMPARE_OPTIONS` and the section explicitly comparing against the named replaced tool. Other sections: forbidden. |

Independent of `flow_mode` — both DIRECTOR and ME follow the same competitor rule.

Implementation: section prompt template injects either:
- `本段禁止出现任何竞品名称(AutoCAD、SolidWorks、中望、浩辰、看图王等)` (forbidden case)
- `本段可以提及竞品,但每个竞品仅一句客观描述,不展开优缺点` (allowed case)

QC layer code scans final body against `competitors` table and flags violations.

---

## 11. Forbidden terms table (~60 seed entries)

Categories defined in `DATA_MODEL.md` §A `forbidden_terms`. Severity: WARN or BAN.

### 11.1 STRUCTURE_CONNECTORS (severity: WARN)
Words that signal mechanical list-of-three / step-by-step AI structure.
```
首先, 其次, 再次, 最后, 综上, 综上所述, 本文, 总之, 概括起来, 总的来说
```

### 11.2 AI_SUMMARY_WORDS (severity: WARN)
Phrases that signal AI conclusion-by-assertion patterns.
```
综上所述, 总而言之, 由此可见, 不难看出, 可以发现, 值得注意的是, 显而易见, 毋庸置疑, 不可否认, 众所周知
```

### 11.3 EMPTY_BENEFITS (severity: WARN)
Marketing benefit words that say nothing concrete.
```
提升, 赋能, 助力, 打造, 高效, 便捷, 强大, 卓越, 优质, 优秀
```

### 11.4 MARKETING_HYPERBOLE (severity: BAN)
Brand-flyer hyperbolic words.
```
极致, 完美, 全方位, 一站式, 革命性, 颠覆性, 全新升级, 重磅, 业界领先, 行业标杆
```

### 11.5 EMPTY_VERBS (severity: WARN)
Verbs that have no concrete action.
```
实现, 做到, 达到, 进行, 开展, 推动, 促进, 优化, 完善, 加强
```

### 11.6 VAGUE_QUANTIFIERS (severity: WARN)
Vague quantity words used instead of numbers.
```
大量, 许多, 多种, 各种, 广泛, 众多, 不少, 相当多, 大幅
```

### 11.7 AI_OPENERS (severity: BAN)
Opener patterns that AI defaults to. Match as substrings.
```
随着数字化技术的不断发展, 随着工业4.0的, 随着XX的不断发展, 在当今, 在现代工程设计中, 作为现代工业的, 本文将为您, 本文将详细介绍, 本文旨在
```

### 11.8 COMPETITOR_LEAK (severity: BAN)
Phrases that, even without naming a competitor, signal that one is being compared. Used when `competitor mention is forbidden` for the section.
```
相比其他CAD软件, 相比传统软件, 与同类产品相比, 比起市面上的, 对比同类
```

### 11.9 GENERIC (severity: WARN)
Other AI-favored generic phrases.
```
应运而生, 不可或缺, 至关重要, 举足轻重, 备受关注, 广受好评, 备受推崇, 不二之选, 必备工具
```

**Total: ~75 entries across 9 categories**. Seed script inserts each as `(term, category, severity)` row in `forbidden_terms`.

---

## 12. Blocked keywords (piracy/cracking content)

Source: previous version `BLOCKED_KEYWORDS`. Substring match (lowercased).

```
注册机
破解
解密
crack
keygen
盗版
序列号
激活码
图纸泄露
反编译
绕过加密
免费获取授权
免费授权
破解版
注册码
激活补丁
patch激活
```

`ingest_keyword` worker: if normalized keyword contains any of these (case-insensitive substring), set `keywords.status = BLOCKED` and `block_reason = matched_term`. No downstream stages run.

---

## 13. Keyword normalization rules (code)

Deterministic transforms applied at `ingest_keyword`:

| Step | Action |
|---|---|
| 1. Trim | Strip leading/trailing whitespace |
| 2. Collapse whitespace | Multiple spaces/tabs/newlines → single space |
| 3. Full-width → half-width | `,` `.` `?` `!` `(` `)` etc. → ASCII equivalents |
| 4. Strip punctuation | Remove `,。?!()【】""''《》、:;~ ` and ASCII equivalents (except internal hyphens in product names like "AutoCAD-2024") |
| 5. Strip emoji | Remove all emoji characters (Unicode emoji blocks) |
| 6. Lowercase ASCII | English letters lowercased; Chinese characters unchanged |
| 7. Strip URLs | `https?://\S+` removed |
| 8. Strip HTML | `<[^>]+>` removed |
| 9. Strip year-only suffix if implied | `"免费 CAD 2024"` stays; `"免费 CAD 2024年"` → "年" stripped if year ≠ current |
| 10. Collapse repeated chars | More than 3 of same char (like "好好好好") → 2 (Chinese), or 1 (ASCII) |

**Do NOT**:
- Translate between Chinese and English
- Auto-correct typos (different keywords are different searches)
- Merge near-synonyms at this stage (that's `cluster_keywords`)
- Stem or lemmatize

After normalization, compute `keyword_hash = sha256(normalized_text)`.

If hash exists already, treat as duplicate; do not insert.

---

## 14. Year rules

Stored in `config_kv.current_year` (auto-updated yearly). Default code reads:

```typescript
const CURRENT_YEAR = parseInt(await getConfig('current_year') ?? new Date().getFullYear().toString());
```

Prompt token: `__CURRENT_YEAR__` is replaced with this value before sending to LLM.

Title rule (enforced in code post-LLM):
- `intent_type IN ('choose', 'replace')`: year ALLOWED in title (e.g. "2026年最佳CAD软件")
- `intent_type IN ('solve', 'learn', 'understand')`: year FORBIDDEN in title. If LLM returns one, strip it.

Body rule (enforced in code post-LLM):
- Any year mention must be CURRENT_YEAR. Years older or future get flagged for QC review.

---

## 15. Banned opening sentence patterns (regex)

Run at QC layer 1 (humanizer code checks) against **the first paragraph** of the article.

Each pattern below catches a typical AI-flavored opener. Patterns are JavaScript regex syntax. Match anywhere in the first paragraph → humanizer score deduction. Two or more matches → automatic QC_FAILED.

```regex
# Pattern A — "随着...的不断发展" style openers
^随着(数字化|工业4\.0|信息化|智能制造|AI技术|人工智能).*不断.*发展

# Pattern B — "XX 是现代...不可或缺" style declarations
^[一-龥]{2,10}是现代(工程设计|工业|制造).*不可或缺

# Pattern C — "本文将为您介绍" style scaffolding
^本文将(为您|为读者)?(详细)?介绍

# Pattern D — "在当今...时代" framing
^在当今.*时代

# Pattern E — "作为现代...的" framing
^作为现代.*的
```

Note: `[一-龥]` is the Unicode range for Chinese characters (U+4E00 to U+9FA5). The earlier draft used `[X一-龥]` which had a stray `X` — patterns above are corrected.

Match → humanizer score deduction. Two or more matches in first paragraph → QC_FAILED.

---

## 16. EEAT enforcement (decided)

Confirmed scope from advisor review. These are **decided**, no further discussion needed:

| EEAT signal | Status | Implementation note |
|---|---|---|
| Author byline | ✅ already exists | Handled by Storyblok publishing pipeline downstream of this system |
| Last-updated timestamp | ✅ add | Insert at top of every article: `最后更新:{{ current_year }} 年 {{ current_month }} 月`. Code, not LLM. Implementation in W4 assemble stage |
| Structured data (schema.org JSON-LD) | ✅ add | Generate Article JSON-LD at publish time; FAQPage JSON-LD if article has FAQ section. Code, not LLM. Implementation in W5 |
| External reference citations | ⏸ deferred | Not in v1 |
| CASE_STUDY content | ⏸ user-curated | User maintains list of real cases; system inserts when relevant. Not auto-generated |
| Admit-limitations (Trustworthiness) | DIRECTOR: ❌ skip / ME: ✅ keep | Already encoded in style anchor split |

**Article body changes for EEAT** are limited to the timestamp insertion (code-level). Real EEAT lift comes from:
1. Honest concrete writing (humanizer enforces)
2. Specific numbers/versions (humanizer rule 19)
3. Real cases when user provides them (CASE_STUDY section, see new skeleton discussion in next window)

---

## 17. Persona / addressing rules

Section prompts always state:

> 写作人称:全文用"你"或不出现第二人称(避免"用户""读者""大家"这类抽离称呼)。
> 不要用"对于 XX 工程师来说"这类按职业分组的开场。
> 不要总结性收尾(综上所述、总而言之等)。

ME mode adds:
> 可以承认 ZIXEL 在某些场景不合适——直接说,不掩饰。

DIRECTOR mode does NOT include the "admit limitations" line.
