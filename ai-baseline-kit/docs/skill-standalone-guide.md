# AI 前端模块装配系统：Skill 独立使用指南

> 适用版本：`0.10.0`  
> 结论摘要：各 Skill 在职责上可以独立调用，但当前并非全部都能“只复制一个 SKILL.md”后完整运行。

## 1. 直接回答

**可以抽离，但要区分“逻辑独立”和“物理自包含”。**

- 逻辑独立：某个 Skill 可以单独承担规划、检查、国际化或需求整理职责；当前已经具备。
- 物理自包含：只复制该 Skill 目录到另一个环境，不依赖 `ai-baseline-kit/docs`、`scripts` 和项目状态就能完整运行；当前只有偏推理型 Skill 接近这一条件。
- 工程闭环独立：Skill 自己包含 schema、脚本、参考资料和验证器，可以独立完成确定性检查；当前大部分仍依赖整包。

因此，公司可以按需单独调用 Skill，但如果要作为独立软件资产分发，建议先执行“Skill 打包导出”，不要直接手工复制一个 `SKILL.md`。

## 2. 独立程度分级

| 等级 | 定义 |
| --- | --- |
| A | 可单独复制使用；缺少整包时仍能完成主要推理任务 |
| B | 可独立调用，但建议同时携带少量规则或项目上下文 |
| C | 依赖多个 schema、脚本或 `.ai-frontend-assembler/`，不建议只复制 Skill |
| D | 总控编排 Skill，设计目标就是调用其他能力，必须依赖整包 |

## 3. 当前 Skill 独立使用矩阵

| Skill | 等级 | 可单独完成 | 完整运行依赖 | 建议 |
| --- | --- | --- | --- | --- |
| `baseline-structure-skill` | B | 开发前结构规划、模块归属、影响面和验证计划 | 项目 `AGENTS.md`、基线规则、项目地图 | 可作为独立规划 Skill，但携带项目规则后更可靠 |
| `baseline-conformance-skill` | B | 人工式结构回归、输出 pass/fail 和修复项 | 基线规则、项目地图；硬检查还依赖 `baseline-check` 和 AST 脚本 | 可单独做审查，不代表完成确定性门禁 |
| `project-i18n-localizer` | B | 识别 i18n、抽取文案、翻译、检查语言覆盖 | 项目真实 i18n 入口、依赖和现有 key 规范 | 适合独立使用，但必须先扫描项目，不能套固定方案 |
| `project-scheme-bootstrap` | C | 指导 AI 识别新旧项目结构 | project scheme schema/template、stack profiles、bootstrap/doctor 脚本 | 建议跟随整包，避免项目地图格式漂移 |
| `requirement-to-feature-spec` | C | 需求理解、事实/推断/未知项分类、提问 | Feature Spec schema/template、项目地图、compiler | 可以单独做需求分析，完整可执行规格需依赖配套文件 |
| `feature-architecture-planner` | C | 将 ready Feature Spec 转为模块和文件计划 | Feature Spec、Change Plan schema、项目地图、规则、planner 脚本 | 不建议脱离需求编译和基线规则单独分发 |
| `intelligent-frontend-assembler` | D | 统一接收需求并编排开发、组合、修复 | 几乎全部 scripts、docs、schemas、state 和其他 Skills | 不应单独抽离；它就是整包装配总控 |

## 4. 适合单独使用的场景

### 4.1 只做开发前结构规划

抽离：

```text
baseline-structure-skill/
```

同时给 AI 提供：

- 目标项目 `AGENTS.md`；
- 项目目录结构；
- 模块边界规则；
- 本次需求。

适合：已有研发流程，只希望 AI 先输出结构化改造方案。

### 4.2 只做开发后架构审查

抽离：

```text
baseline-conformance-skill/
```

同时提供：

- 项目规则；
- 修改前后的 diff；
- 开发前计划；
- 项目地图。

适合：作为 Code Review 辅助。注意：没有 AST 和脚本时只能得到 AI 审查结果，不是硬门禁。

### 4.3 只做国际化

抽离：

```text
project-i18n-localizer/
```

同时提供：

- 项目 package manifest；
- i18n 初始化入口；
- 现有语言文件；
- 页面或模块代码；
- key 命名规则。

适合：文案抽取、中文转英文、语言覆盖检查。默认推荐扁平稳定 key。

### 4.4 只做产品需求结构化

可以调用 `requirement-to-feature-spec`，但建议将下列文件一起打包：

```text
skills/requirement-to-feature-spec/SKILL.md
docs/feature-spec.schema.json
docs/feature-spec.template.json
scripts/requirement-compile.mjs
scripts/feature-tools-lib.mjs
```

如果没有项目地图，它只能生成通用需求规格，不能可靠决定模块、路由和项目文件边界。

## 5. 不建议单独抽离的能力

### 5.1 intelligent-frontend-assembler

它是总控 Skill，职责是路由和编排：

```text
需求编译 → 结构规划 → 受控执行 → 测试 → 验证 → 修复/回滚
```

单独复制总控 Skill 会留下大量失效路径和不存在的脚本，表面上能阅读，实际上无法完成闭环。

### 5.2 project-scheme-bootstrap

项目地图必须符合 schema，并且需要 doctor/bootstrap 脚本识别真实项目。手工抽离容易产生“看似完整、实际字段不兼容”的地图。

### 5.3 feature-architecture-planner

它依赖 ready Feature Spec、项目地图和规则。如果绕过这些前置条件，会重新变成 AI 自由发挥。

## 6. 推荐的独立 Skill 包格式

如果公司要把某个 Skill 登记为独立资产，建议使用：

```text
<skill-name>/
├── SKILL.md
├── README.md
├── VERSION
├── agents/
│   └── openai.yaml        # 仅在实际需要时保留
├── references/
│   ├── dependency-manifest.json
│   ├── 所需规则或 schema
│   └── 示例输入输出
├── scripts/
│   └── 该 Skill 必需的确定性脚本
├── assets/
│   └── 模板或静态资源
└── tests/
    └── 契约和样例回归
```

`dependency-manifest.json` 建议包含：

```json
{
  "name": "requirement-to-feature-spec",
  "version": "0.10.0",
  "requires": {
    "projectFiles": ["AGENTS.md"],
    "references": [
      "feature-spec.schema.json",
      "feature-spec.template.json"
    ],
    "scripts": [
      "requirement-compile.mjs",
      "feature-tools-lib.mjs"
    ],
    "optionalState": [
      ".ai-frontend-assembler/project-scheme.yml"
    ]
  }
}
```

## 7. 抽离时必须处理的路径问题

当前 Skill 文档中存在类似路径：

```text
ai-baseline-kit/docs/baseline-rules.yml
ai-baseline-kit/scripts/requirement-compile.mjs
project_root/.ai-frontend-assembler/project-scheme.yml
```

物理抽离后必须：

1. 将依赖文件复制进 Skill 的 `references/` 或 `scripts/`；
2. 将 `SKILL.md` 中的固定路径改为 Skill 相对路径；
3. 明确 `project_root` 的发现方式；
4. 不把项目专属状态打包进 Skill；
5. 增加缺失依赖时的明确错误，而不是让 AI 猜测；
6. 对抽离包单独执行契约测试。

## 8. 独立使用不等于独立强约束

只复制 Skill 后，AI 可以获得专业工作流，但硬约束能力可能下降：

| 能力 | 只有 Skill | Skill + 配套脚本 | 完整装配系统 |
| --- | --- | --- | --- |
| AI 工作步骤提示 | 有 | 有 | 有 |
| Schema 校验 | 可能没有 | 有 | 有 |
| 文件白名单执行 | 没有 | 视打包内容 | 有 |
| AST 边界检查 | 没有 | 视打包内容 | 有 |
| 自动测试和构建 | 没有 | 视打包内容 | 有 |
| 事务和回滚 | 没有 | 视打包内容 | 有 |
| 跨项目组合 | 没有 | 不建议 | 有 |

所以：

> 单独 Skill 更像“专业 AI 工作说明”，完整装配系统才是“可验证的工程闭环”。

## 9. 公司推荐策略

建议分为两类资产：

### 9.1 主产品资产

```text
AI 前端模块装配系统 / ai-baseline-kit
```

用于正式项目开发、模块组合和 CI 门禁，整包版本化。

### 9.2 可选独立 Skill 资产

优先抽离：

1. `baseline-structure-skill`；
2. `baseline-conformance-skill`；
3. `project-i18n-localizer`；
4. `requirement-to-feature-spec` 的参考资料增强版。

暂不单独分发：

1. `intelligent-frontend-assembler`；
2. `feature-architecture-planner`；
3. `project-scheme-bootstrap`。

## 10. 抽离验收清单

- [ ] Skill 目录具有合法 `SKILL.md` frontmatter；
- [ ] description 明确说明触发条件；
- [ ] 所有固定路径已改为包内相对路径或项目根路径；
- [ ] 所需 schema、模板和脚本已包含；
- [ ] 没有复制目标项目的 `.ai-frontend-assembler/` 状态；
- [ ] 缺少依赖时会阻断并提示；
- [ ] 包含至少一个成功样例和一个失败样例；
- [ ] 确定性脚本已实际运行；
- [ ] 独立 Skill 版本与主系统兼容范围已登记；
- [ ] 公司资产登记中明确主系统与独立 Skill 的派生关系。

## 11. 最终结论

- **能单独调用：可以。**
- **能只复制任意一个 `SKILL.md` 就保持完整能力：不可以。**
- **最适合先独立资产化：结构规划、基线审查、国际化。**
- **必须保留整包：统一智能装配、受控执行、自动修复、模块组合和最终 Gate。**

如果后续需要真正“一键导出独立 Skill”，建议新增 `skill-export`、`skill-dependency-check` 和独立 Skill 契约测试，而不是手工复制。
