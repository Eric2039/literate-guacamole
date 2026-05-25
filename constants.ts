// mvp/constants.ts
//
// ⚠️ MVP-ONLY: Hardcoded constants. Violates CONSTRAINTS B7 / B11 (no hardcoded
// prompts / seed data in code). MVP-stage exemption per branch-mvp/DECISIONS_v3 §C.2/C.3.
// Once MVP passes quality validation, these move to DB per branch-original spec.
//
// Spec mapping (any change here MUST be mirrored in spec — see mvp/run.md §10):
//   ROLE_WORD_TARGETS     → branch-original/DECISIONS_v3.md §B.5
//   UNIVERSAL_CONSTRAINTS → branch-original/DECISIONS_v3.md §B.2
//   MODE_CONSTRAINTS      → branch-original/DECISIONS_v3.md §B.3
//   INTENT_CONSTRAINTS    → branch-original/DECISIONS_v3.md §B.4
//   ZIXEL_FEATURES        → reference/inherited_rules.md §7
//   FORBIDDEN_TERMS       → reference/inherited_rules.md §11
//   KAZIK_FORBIDDEN_TERMS → reference/kazik_adaptation.md §1.1
//   CATEGORY_SLUGS / CTA  → reference/inherited_rules.md §6 / §8

// ---------------------------------------------------------------------------
// Type aliases
// ---------------------------------------------------------------------------

export type IntentType = "learn" | "solve" | "choose" | "replace" | "understand";

export type FlowMode = "DIRECTOR" | "ME"; // MVP only uses DIRECTOR

export type RoleInArc =
  // Existing 8
  | "INTRO_PAIN"
  | "ANALYZE_CAUSE"
  | "COMPARE_OPTIONS"
  | "HOW_TO_STEP"
  | "BRIDGE_TO_PRODUCT"
  | "CTA"
  | "CONTEXT"
  | "CONCLUSION"
  // New 12
  | "DEFINITION"
  | "MECHANISM"
  | "REAL_USAGE"
  | "WHEN_TO_USE_WHICH"
  | "SCENARIO_BREAKDOWN"
  | "COMMON_MISTAKES"
  | "DECISION_FRAMEWORK"
  | "DIMENSION_ANALYSIS"
  | "LIMITATIONS_OF_CATEGORY"
  | "WHY_LEAVING"
  | "MIGRATION_BLOCKERS"
  | "FAQ";

export const ALL_ROLES: RoleInArc[] = [
  "INTRO_PAIN", "ANALYZE_CAUSE", "COMPARE_OPTIONS", "HOW_TO_STEP",
  "BRIDGE_TO_PRODUCT", "CTA", "CONTEXT", "CONCLUSION",
  "DEFINITION", "MECHANISM", "REAL_USAGE", "WHEN_TO_USE_WHICH",
  "SCENARIO_BREAKDOWN", "COMMON_MISTAKES", "DECISION_FRAMEWORK",
  "DIMENSION_ANALYSIS", "LIMITATIONS_OF_CATEGORY", "WHY_LEAVING",
  "MIGRATION_BLOCKERS", "FAQ",
];

export type ProductFeature = {
  product: string;
  feature_name: string;
  description: string;
  value_proposition: string;
  priority: "LEAD" | "NORMAL" | "FALLBACK";
};

// ---------------------------------------------------------------------------
// UNIVERSAL_CONSTRAINTS — branch-original/DECISIONS_v3.md §B.2
// ---------------------------------------------------------------------------

export const UNIVERSAL_CONSTRAINTS = {
  min_sections: 5,
  max_sections: 9,
  must_start_with: "INTRO_PAIN" as RoleInArc,
  must_end_with_one_of: ["FAQ", "CTA"] as RoleInArc[],
  required_roles: ["INTRO_PAIN", "FAQ"] as RoleInArc[],
  total_word_floor: 1500,
} as const;

// ---------------------------------------------------------------------------
// MODE_CONSTRAINTS — branch-original/DECISIONS_v3.md §B.3
// MVP only uses DIRECTOR but ME kept here for spec parity.
// ---------------------------------------------------------------------------

export const MODE_CONSTRAINTS: Record<FlowMode, {
  required_roles_in_addition: RoleInArc[];
  forbidden_roles: RoleInArc[];
  has_thesis: boolean;
  bridge_position?: "before_tail";
  soft_brand_mention_required?: boolean;
}> = {
  DIRECTOR: {
    required_roles_in_addition: ["BRIDGE_TO_PRODUCT", "CTA"],
    forbidden_roles: [],
    has_thesis: true,
    bridge_position: "before_tail",
  },
  ME: {
    required_roles_in_addition: [],
    forbidden_roles: ["CTA"],
    has_thesis: false,
    soft_brand_mention_required: true,
  },
};

// ---------------------------------------------------------------------------
// INTENT_CONSTRAINTS — branch-original/DECISIONS_v3.md §B.4
// ---------------------------------------------------------------------------

export const INTENT_CONSTRAINTS: Record<IntentType, {
  forbidden_roles: RoleInArc[];
  required_roles: RoleInArc[];
}> = {
  learn: {
    forbidden_roles: ["WHY_LEAVING", "MIGRATION_BLOCKERS"],
    required_roles: ["DEFINITION"],
  },
  understand: {
    forbidden_roles: ["WHY_LEAVING", "MIGRATION_BLOCKERS", "HOW_TO_STEP"],
    required_roles: ["WHEN_TO_USE_WHICH"],
  },
  solve: {
    forbidden_roles: ["WHY_LEAVING", "MIGRATION_BLOCKERS"],
    required_roles: ["HOW_TO_STEP"],
  },
  choose: {
    forbidden_roles: ["WHY_LEAVING", "MIGRATION_BLOCKERS"],
    required_roles: ["DECISION_FRAMEWORK"],
  },
  replace: {
    forbidden_roles: [],
    required_roles: ["WHY_LEAVING", "HOW_TO_STEP"],
  },
};

// ---------------------------------------------------------------------------
// ROLE_WORD_TARGETS — branch-original/DECISIONS_v3.md §B.5
// [min, max] per role
// ---------------------------------------------------------------------------

export const ROLE_WORD_TARGETS: Record<RoleInArc, [number, number]> = {
  INTRO_PAIN: [100, 200],
  DEFINITION: [100, 180],
  MECHANISM: [200, 300],
  ANALYZE_CAUSE: [200, 280],
  HOW_TO_STEP: [250, 350],
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
  FAQ: [200, 350],
  CTA: [30, 80],
  CONTEXT: [150, 220],
  CONCLUSION: [100, 150],
};

// ---------------------------------------------------------------------------
// ROLE_WRITING_GUIDANCE — branch-original/DECISIONS_v3.md §C.3
// Short brief shown to LLM in genSection prompt to anchor the role's writing voice.
// ---------------------------------------------------------------------------

export const ROLE_WRITING_GUIDANCE: Record<RoleInArc, string> = {
  INTRO_PAIN: "点出读者真实的痛点场景。首句必须是自包含的陈述句, 直接回答关键词所问 (TL;DR)。第二句开始转入对话式痛点。",
  DEFINITION: "短陈述, X 是 Y 的句式。不展开, 不举例, 直接给定义。允许首句脱离上下文阅读。",
  MECHANISM: "因果或结构性说明 怎么/为什么。解释机制, 不解释定义。可分 2-3 个机制要点。",
  ANALYZE_CAUSE: "原因分析。找根本原因, 不绕弯, 不堆形容词。",
  COMPARE_OPTIONS: "比较选项。除非 intent 是 choose / replace 且本段允许点名, 否则不出现任何竞品名 (见 prompt 注入的本段竞品规则)。",
  HOW_TO_STEP: "操作步骤。用编号列表 (1. 2. 3.) 或清晰分段。每步一个动作 + 具体到软件版本/菜单位置/按钮名。",
  COMMON_MISTAKES: "纠错性。2-3 个常见错误, 每个先说错在哪再说怎么对。",
  SCENARIO_BREAKDOWN: "列举 2-3 个具体可识别的用户场景, 每场景一段。不假设场景, 用真实情况。",
  WHEN_TO_USE_WHICH: "给判断标准。讨论什么时候选 A 什么时候选 B。不点名品牌。不要表格 (留给 DIMENSION_ANALYSIS)。",
  DIMENSION_ANALYSIS: "按维度展开 (3-5 个维度逐个分析)。不要把竞品名作为列标题。表格允许但 markdown 表格。",
  DECISION_FRAMEWORK: "教读者一个判断框架, 让 ta 自己判断。不直接推荐某个产品。",
  LIMITATIONS_OF_CATEGORY: "批判类别整体不批品牌。说这类工具普遍存在的问题, 不说X工具有这个问题。反贬损的核心承载段。",
  REAL_USAGE: "实际场景叙事, 偏轶事但保持工程师姿态。具体场景 + 真实做法, 不泛泛而谈。",
  BRIDGE_TO_PRODUCT: "Help-Don't-Sell pattern: 先说场景痛点 → 自然带出 ZIXEL → 具体讲产品做什么 → 邀请体验, 不卖。",
  CTA: "(此段由代码生成, 不调 LLM)",
  CONTEXT: "背景铺陈, 给读者理解后文需要的上下文。",
  CONCLUSION: "短总结收束, 不用 综上所述 / 总而言之 / 总的来说 等 AI 收尾词。",
  WHY_LEAVING: "读者为什么想换 (痛点 + 触发事件)。不批旧工具具体厂商。",
  MIGRATION_BLOCKERS: "实际迁移会遇到的问题 (数据格式 / 学习曲线 / 团队推动等)。给 awareness 不给安慰。",
  FAQ: "3 个真实问题 + 短答, 每答 60-100 字。问题要像 SerpAPI People Also Ask 那样真实。markdown 用 ### Q: ... 形式。",
};

// ---------------------------------------------------------------------------
// ZIXEL_FEATURES — inherited_rules.md §7
// Flattened ProductFeature[] for prompt injection. priority preserved for thesis selection.
// ---------------------------------------------------------------------------

export const ZIXEL_FEATURES: ProductFeature[] = [
  // 云原生3D CAD
  { product: "云原生3D CAD", feature_name: "云原生架构与自研核心", description: "基于云原生架构与自研核心打造的三维 CAD 平台,支持草图、零件、装配、工程图基础模块", value_proposition: "无需依赖外部内核,核心自主可控", priority: "LEAD" },
  { product: "云原生3D CAD", feature_name: "免安装 Web 设计", description: "无需本地安装,通过浏览器即可访问和编辑设计文件", value_proposition: "降低使用门槛、跨设备使用", priority: "LEAD" },
  { product: "云原生3D CAD", feature_name: "多端支持与灵活部署", description: "支持 PC、移动端、私有化部署多种使用方式", value_proposition: "灵活适配不同企业 IT 环境", priority: "NORMAL" },
  { product: "云原生3D CAD", feature_name: "云端版本管理", description: "设计文件版本由云端统一管理,可随时回溯到历史版本", value_proposition: "避免版本混乱、丢稿", priority: "LEAD" },
  { product: "云原生3D CAD", feature_name: "实时协同设计", description: "多人可同时在线编辑同一设计文件,修改实时同步", value_proposition: "多人设计、设计共享更高效", priority: "LEAD" },
  { product: "云原生3D CAD", feature_name: "AI 与参数化设计", description: "结合 AI 与参数化设计能力,可自然语言驱动参数化模型生成", value_proposition: "加快复杂建模和设计表达", priority: "NORMAL" },
  { product: "云原生3D CAD", feature_name: "工程图模块", description: "支持工程图的创建与维护", value_proposition: "设计与出图一体化", priority: "NORMAL" },

  // 3D一览通
  { product: "3D一览通", feature_name: "50+ 格式兼容", description: "兼容 50+ 主流 CAD 文件格式(DWG/DXF/STP/STEP/IGES/OBJ/SLDPRT/SLDASM/3DM 等)", value_proposition: "不论上下游用什么软件都能打开", priority: "LEAD" },
  { product: "3D一览通", feature_name: "免安装浏览器查看", description: "无需安装即可在浏览器中查看 3D 模型与 2D 图纸", value_proposition: "即开即用,无硬件门槛", priority: "LEAD" },
  { product: "3D一览通", feature_name: "实时批注与评论", description: "多人在同一模型上同步批注、评论、测量", value_proposition: "评审从来回发文件变成围绕模型在线协作", priority: "LEAD" },
  { product: "3D一览通", feature_name: "测量与剖切", description: "支持测量、剖切、爆炸图", value_proposition: "远程也能完成评审操作", priority: "NORMAL" },
  { product: "3D一览通", feature_name: "PMI 展示与属性查看", description: "支持 PMI(产品制造信息)展示、模型结构树与属性查看", value_proposition: "制造端能看到完整设计意图", priority: "NORMAL" },
  { product: "3D一览通", feature_name: "权限管理", description: "文件级、模型级权限控制", value_proposition: "保护图纸不外泄", priority: "NORMAL" },
  { product: "3D一览通", feature_name: "SDK 集成", description: "提供 SDK 可嵌入 PLM/MES/钉钉/飞书等业务系统", value_proposition: "与企业现有系统对接", priority: "NORMAL" },
  { product: "3D一览通", feature_name: "私有化部署", description: "支持私有化部署,避免图纸泄露风险", value_proposition: "数据安全可控", priority: "NORMAL" },

  // PDM
  { product: "PDM", feature_name: "图文档集中存储", description: "统一管理产品全生命周期的图纸、文档与文件", value_proposition: "消灭信息孤岛", priority: "LEAD" },
  { product: "PDM", feature_name: "BOM 管理", description: "支持 BOM 创建、版本控制、变更追溯", value_proposition: "BOM 与设计同步,变更可追溯", priority: "LEAD" },
  { product: "PDM", feature_name: "版本控制", description: "自动记录每次修改并支持版本对比、回滚", value_proposition: "变更可追溯、可回滚", priority: "NORMAL" },
  { product: "PDM", feature_name: "权限管理", description: "细粒度权限分配", value_proposition: "数据安全可控", priority: "NORMAL" },
  { product: "PDM", feature_name: "任务分派与进度跟踪", description: "任务可分派到人、可跟踪进度", value_proposition: "研发任务有人管、有结果", priority: "NORMAL" },
  { product: "PDM", feature_name: "项目看板", description: "项目级看板可视化进度", value_proposition: "项目透明度提升", priority: "NORMAL" },
  { product: "PDM", feature_name: "流程驱动协同", description: "让研发流程从文件驱动走向流程驱动", value_proposition: "减少沟通断层", priority: "LEAD" },

  // 3D工艺大师
  { product: "3D工艺大师", feature_name: "直接复用 CAD 数据", description: "直接基于 CAD 源数据生成工艺文档,无需重复建模", value_proposition: "工艺与设计同源,变更同步", priority: "LEAD" },
  { product: "3D工艺大师", feature_name: "用户手册生成", description: "自动生成用户手册、维修手册、装配说明", value_proposition: "工艺文档输出周期大幅缩短", priority: "NORMAL" },
  { product: "3D工艺大师", feature_name: "技术插图与交互动画", description: "生成技术插图、交互动画、3D 工艺卡片", value_proposition: "交付物更丰富、更直观", priority: "NORMAL" },
  { product: "3D工艺大师", feature_name: "PMI/BOM 信息接入", description: "PMI 与 BOM 信息可直接接入工艺文档", value_proposition: "工艺信息完整、规范", priority: "NORMAL" },
  { product: "3D工艺大师", feature_name: "设计变更实时同步", description: "设计变更可实时同步到工艺文档", value_proposition: "工艺维护成本降低", priority: "LEAD" },
  { product: "3D工艺大师", feature_name: "AI 拆解与动画脚本", description: "AI 可生成驱动 3D 拆解与动画的脚本", value_proposition: "推动工艺数字化迈向智能化", priority: "NORMAL" },

  // 几何搜索
  { product: "几何搜索", feature_name: "3D 形状搜索", description: "按 3D 形状特征搜索相似模型", value_proposition: "快速定位历史零部件", priority: "LEAD" },
  { product: "几何搜索", feature_name: "图片搜索", description: "按图片(2D 或 3D 渲染图)搜索模型", value_proposition: "凭直觉就能查到模型", priority: "NORMAL" },
  { product: "几何搜索", feature_name: "文本与颜色搜索", description: "按文本描述或颜色检索模型", value_proposition: "多种检索维度灵活组合", priority: "NORMAL" },
  { product: "几何搜索", feature_name: "综合条件搜索", description: "多条件组合检索", value_proposition: "复杂查询场景适用", priority: "NORMAL" },
  { product: "几何搜索", feature_name: "自然语言驱动参数化生成", description: "自然语言指令驱动参数化模型生成", value_proposition: "重复建模工作量减少", priority: "NORMAL" },
  { product: "几何搜索", feature_name: "知识图谱与参数化逻辑", description: "系统通过知识图谱理解设计需求与参数关系", value_proposition: "让 AI 真正参与设计", priority: "FALLBACK" },

  // 子虔科技平台 (umbrella)
  { product: "子虔科技平台", feature_name: "一体化研发协同平台", description: "CAD/PDM/3D一览通/3D工艺大师/几何搜索五大模块组成的一体化平台", value_proposition: "不是增加一个工具,而是重构研发协作方式", priority: "LEAD" },
  { product: "子虔科技平台", feature_name: "建模/看模/管模/用模闭环", description: "围绕设计、查看、管理、复用模型四个环节构建闭环", value_proposition: "模型从设计文件升级为可协同/可管理/可复用/可交付的数字资产", priority: "LEAD" },
  { product: "子虔科技平台", feature_name: "行业聚焦制造业", description: "面向制造业、航空航天、机器人、工业自动化行业", value_proposition: "行业理解深入,场景匹配", priority: "NORMAL" },
  { product: "子虔科技平台", feature_name: "自主可控", description: "基于自研核心", value_proposition: "不依赖外部内核,核心可控", priority: "NORMAL" },
];

// ---------------------------------------------------------------------------
// FORBIDDEN_TERMS — inherited_rules.md §11 (MVP-simplified: core list, BAN-heavy)
// MVP keeps full categorization so humanizer scan output can be specific.
// ---------------------------------------------------------------------------

export type ForbiddenTerm = {
  term: string;
  category: "STRUCTURE_CONNECTORS" | "AI_SUMMARY_WORDS" | "EMPTY_BENEFITS"
          | "MARKETING_HYPERBOLE" | "EMPTY_VERBS" | "VAGUE_QUANTIFIERS"
          | "AI_OPENERS" | "COMPETITOR_LEAK" | "GENERIC";
  severity: "WARN" | "BAN";
};

export const FORBIDDEN_TERMS: ForbiddenTerm[] = [
  // STRUCTURE_CONNECTORS (WARN)
  ...["首先", "其次", "再次", "最后", "综上", "综上所述", "本文", "总之", "概括起来", "总的来说"]
    .map(term => ({ term, category: "STRUCTURE_CONNECTORS" as const, severity: "WARN" as const })),

  // AI_SUMMARY_WORDS (WARN)
  ...["综上所述", "总而言之", "由此可见", "不难看出", "可以发现", "值得注意的是", "显而易见", "毋庸置疑", "不可否认", "众所周知"]
    .map(term => ({ term, category: "AI_SUMMARY_WORDS" as const, severity: "WARN" as const })),

  // EMPTY_BENEFITS (WARN)
  ...["提升", "赋能", "助力", "打造", "高效", "便捷", "强大", "卓越", "优质", "优秀"]
    .map(term => ({ term, category: "EMPTY_BENEFITS" as const, severity: "WARN" as const })),

  // MARKETING_HYPERBOLE (BAN)
  ...["极致", "完美", "全方位", "一站式", "革命性", "颠覆性", "全新升级", "重磅", "业界领先", "行业标杆"]
    .map(term => ({ term, category: "MARKETING_HYPERBOLE" as const, severity: "BAN" as const })),

  // EMPTY_VERBS (WARN)
  ...["实现", "做到", "达到", "进行", "开展", "推动", "促进", "优化", "完善", "加强"]
    .map(term => ({ term, category: "EMPTY_VERBS" as const, severity: "WARN" as const })),

  // VAGUE_QUANTIFIERS (WARN)
  ...["大量", "许多", "多种", "各种", "广泛", "众多", "不少", "相当多", "大幅"]
    .map(term => ({ term, category: "VAGUE_QUANTIFIERS" as const, severity: "WARN" as const })),

  // AI_OPENERS (BAN) — substring match
  ...["随着数字化技术的不断发展", "随着工业4.0的", "在当今", "在现代工程设计中", "作为现代工业的", "本文将为您", "本文将详细介绍", "本文旨在"]
    .map(term => ({ term, category: "AI_OPENERS" as const, severity: "BAN" as const })),

  // COMPETITOR_LEAK (BAN, used when section forbids competitor mention — solve case)
  ...["相比其他CAD软件", "相比传统软件", "与同类产品相比", "比起市面上的", "对比同类"]
    .map(term => ({ term, category: "COMPETITOR_LEAK" as const, severity: "BAN" as const })),

  // GENERIC (WARN)
  ...["应运而生", "不可或缺", "至关重要", "举足轻重", "备受关注", "广受好评", "备受推崇", "不二之选", "必备工具"]
    .map(term => ({ term, category: "GENERIC" as const, severity: "WARN" as const })),
];

// ---------------------------------------------------------------------------
// KAZIK_FORBIDDEN_TERMS — kazik_adaptation.md §1.1
// Heavy AI-flavor signals. Used both in prompt (LLM-side prevention) and scan.
// ---------------------------------------------------------------------------

export const KAZIK_FORBIDDEN_TERMS: Array<{ term: string; replacement_hint: string }> = [
  { term: "说白了", replacement_hint: "坦率的讲 / 其实就是" },
  { term: "意味着", replacement_hint: "那结果会怎样呢 / 所以呢" },
  { term: "这意味着", replacement_hint: "那结果会怎样呢 / 所以呢" },
  { term: "本质上", replacement_hint: "说到底 / 其实" },
  { term: "换句话说", replacement_hint: "你想想看 / 也就是说" },
  { term: "不可否认", replacement_hint: "直接删, 改正面陈述" },
  { term: "综上所述", replacement_hint: "具体的回扣句" },
  { term: "总的来说", replacement_hint: "具体的回扣句" },
  { term: "首先", replacement_hint: "自然转场词或直接进入" },
  { term: "其次", replacement_hint: "自然转场词" },
  { term: "值得注意的是", replacement_hint: "直接说" },
  { term: "不难发现", replacement_hint: "直接说" },
  { term: "让我们来看看", replacement_hint: "直接进入内容" },
  { term: "接下来让我们", replacement_hint: "直接进入内容" },
  { term: "在当今", replacement_hint: "删, 从具体事件切入" },
  { term: "随着", replacement_hint: "删, 从具体事件切入 (与 的发展 / 的不断发展 共现时算命中)" },
];

// Punctuation rules in body paragraphs (NOT in H2/H3 titles). kazik_adaptation §1.2
export const KAZIK_FORBIDDEN_PUNCTUATION: Array<{ pattern: string; replacement_hint: string }> = [
  { pattern: ":", replacement_hint: "用逗号 , 代替" },
  { pattern: ":", replacement_hint: "用逗号 代替 (中文全角冒号)" },
  { pattern: "——", replacement_hint: "用逗号或句号代替" },
];

// ---------------------------------------------------------------------------
// FORBIDDEN_COMPETITORS — for prompt injection (gen_plan + gen_section)
// Names that must NEVER appear in body for solve/learn/understand intents.
// ---------------------------------------------------------------------------

export const FORBIDDEN_COMPETITORS: string[] = [
  "AutoCAD", "SolidWorks", "中望", "中望CAD", "浩辰", "浩辰CAD",
  "CAXA", "看图王", "天正CAD", "Onshape", "Fusion 360", "Fusion360",
  "Inventor", "CATIA", "PTC Creo", "Creo", "Rhino", "Rhinoceros",
  "Tinkercad", "FreeCAD",
];

// ---------------------------------------------------------------------------
// CATEGORY_SLUGS — inherited_rules.md §6 / §8
// ---------------------------------------------------------------------------

export const CATEGORY_SLUGS: Record<string, string> = {
  "CAD文件": "files",
  "CAD常见问题": "faq",
  "CAD名词解释": "glossary",
  "CAD协作": "collaboration",
  "CAD建模": "3d",
  "CAD行业观察": "industry",
  "CAD快捷键": "shortcuts",
  "CAD工程图": "drawings",
  "CAD集成应用": "integration",
  "CAD产品资讯": "product",
};

export const CATEGORIES: string[] = Object.keys(CATEGORY_SLUGS);

// CTA template — inherited_rules.md §8
export function buildCtaMarkdown(category: string): string {
  const slug = CATEGORY_SLUGS[category] ?? "faq";
  return `如果你想了解更多 [${category}](https://www.zixel3d.com/cad-faqs/${slug}) 相关知识,请关注子虔科技 [子虔Zixel](https://www.zixel3d.com/) 了解更多。`;
}

// Fallback category by intent — inherited_rules.md §6
export function fallbackCategory(intent: IntentType): string {
  switch (intent) {
    case "learn": case "understand": return "CAD名词解释";
    case "solve": return "CAD常见问题";
    case "choose": case "replace": return "CAD产品资讯";
  }
}
