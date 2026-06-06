# Development Log

## 2026-06-06 首次提交整理

### 整理范围

本次为首次自动化整理，`docs/development-log.md` 此前不存在，因此将当前 `main` 分支已有提交全部纳入开发记录。整理范围从初始化提交 `f4525d1c481172087d2d7d9ccb8c3405ebdc51eb` 到当前 HEAD `83f317a223db1f9eda3d7d0a8ab669232df2b1c8`。

### 主要功能变更

1. 初始化 KL 3D 钢筋可视化应用
   - 建立基于 Vite、React、TypeScript、Tailwind 的前端工程。
   - 实现 KL 梁参数输入、派生数据计算、混凝土体、纵筋、箍筋、钢筋路径等基础 3D 可视化能力。
   - 引入 16G101 相关规则基础数据，并通过 `beamStore` 管理梁参数状态。
   - 配置 GitHub Pages / Vite 部署基础流程。

2. 梁端柱、箍筋和结构准确性增强
   - 增加 600x600 梁端柱建模，支座按柱宽对齐，并扩展上下 1m。
   - 箍筋支持交替弯钩、圆角弯折、右上角弯钩和 5d 搭接等表现。
   - 规范升级为 22G101-1 规则命名与 UI 展示。
   - 修复弯锚逻辑中硬编码 `15 * dia` 的问题，改为由规则函数推导。

3. 工作台 UI 与参数面板演进
   - 从初始面板迭代到 STEELCORE / Aero-Precision 风格工作台。
   - 增加侧边导航、顶部栏、视口 HUD、数据面板、参数面板等完整工作区结构。
   - 参数面板支持更多梁截面、钢筋、箍筋、柱截面和标注开关配置。
   - 增加可调整宽度的参数面板与剖切面面板展开/缩放体验。

4. 多构件架构与柱模块
   - 引入 `MemberType`、构件注册表、`memberStore`，从单 KL 梁扩展到多构件框架。
   - 增加 KZ 柱模块、柱参数推导、柱 3D 场景、柱 store 与视角联动。
   - 增加项目导入/导出能力，为跨构件项目保存和恢复打基础。
   - 新增通用字段组件 `NumField`、`SelectField`、`BundleEditor`，减少参数表单重复实现。

5. 梁子类型与菜单体系
   - 在配置层扩展 KL、L、WKL、XL 等梁类型。
   - 使用 `memberRegistry` 注册梁子类型，复用现有梁视图、数据和参数组件。
   - 侧边导航改为梁级联子菜单，默认展开梁族构件。
   - 将硬编码 `isBeam` 判断收敛为梁族判断，减少后续扩展风险。

6. 钢筋构造深化
   - 增加中部钢筋，覆盖构造筋和扭筋场景。
   - 支座负筋按表拆分两排，一排按 `ln / 3`，二排按 `ln / 4`。
   - 下部二排钢筋区分角筋与中间筋，单排最大根数可自动拆分。
   - 4 肢箍筋同时支持 3D 场景和剖切面表现。
   - 拉筋采用外包绿色构造筋和平滑弧线，内箍筋包绕中部两根主筋。
   - 弯钩按上 1、上 2、下 1、下 2 自外向内分层错开，步距使用 `max(dia) + 25`。

7. 标注系统
   - 新增 `BeamAnnotations.tsx` 3D 尺寸标注组件。
   - 支持负筋伸出长度、箍筋加密区长度、净跨尺寸标注。
   - 标注带尺寸线和 45 度起止斜线，字号可配置。
   - 右侧面板提供负筋、加密区、净跨标注显隐开关。

8. 落地页与导航体验
   - 新增 `LandingPage.tsx`，应用启动后可展示项目入口页。
   - 增加返回导航，调整主入口与工作台之间的切换。
   - 数据面板支持分区展开与宽度调整，便于复杂钢筋数据查看。

9. AI 助手
   - 新增 AI 助手 PRD 文档，沉淀平法助手需求。
   - 新增助手面板、聊天气泡、输入框、Markdown 渲染、模型选择器和建议问题。
   - 增加 `aiStore` 与 provider 抽象，接入 DeepSeek provider。
   - 放开 API key 前置阻断，增加自然语言输入和优化开关。

10. CI/CD 与部署
    - 初始化 GitHub Actions 部署配置。
    - 升级 Actions 到 Node 24 相关版本，处理弃用提示。
    - 增加 Netlify 配置和 CI workflow，覆盖构建检查链路。

### 关键实现点

1. 几何与领域计算分层
   - 梁、柱参数推导集中在 `src/domain/**`。
   - 具体几何构造集中在 `src/geometry/**`。
   - 3D 渲染组件集中在 `src/scene/**`。
   - UI 参数输入、数据查看与导航集中在 `src/ui/**`。

2. 规则与表现解耦
   - 代码规则从 `16G101` 演进为 `22G101`，并逐步将硬编码替换为规则函数或推导函数。
   - 最大单排钢筋数量、弯锚长度、负筋分排长度等逻辑从 UI 表现中抽出，降低视觉层误改结构规则的风险。

3. 多构件扩展方式
   - `memberRegistry` 使构件扩展从分散条件判断转向注册表驱动。
   - 梁族子类型复用组件，降低 KL、L、WKL、XL 之间重复实现成本。
   - 柱模块通过独立 store、derive 和 scene 接入，验证了多构件架构的可行性。

4. 复杂钢筋表现策略
   - 纵筋、负筋、中部钢筋、拉筋、箍筋分别由几何构造函数生成，再由渲染组件消费。
   - 对弯钩、分层错开、颜色区分、圆角路径等视觉细节做局部增强，避免一次性重写整套几何系统。
   - 剖切面和 3D 场景共享部分派生数据，降低两套视图之间的数据偏差。

5. AI 助手模块化
   - UI 组件、状态 store、provider 类型和具体 DeepSeek provider 分层清晰。
   - Markdown 渲染、模型选择、建议问题、输入框等功能独立组件化，便于后续替换 provider 或增加工具调用。

### 经验教训

1. 工程规则不能长期藏在 UI 中
   - 多次提交都在修复硬编码、分排、锚固和箍筋表现问题，说明结构规则应尽早沉淀在 domain / geometry 层。

2. 多构件扩展应优先建立注册机制
   - 从单梁扩展到柱、梁子类型后，直接条件判断会快速膨胀。`memberRegistry` 是后续继续扩展构件类型的关键基础。

3. 可视化颜色和几何偏移是工程语义的一部分
   - 二排筋改色、弯钩分层错开、拉筋外包、内箍筋包绕等并非单纯美化，它们直接影响用户理解钢筋关系。

4. Store 版本迁移需要持续记录
   - 提交中多次出现 store 版本升级，后续每次持久化结构调整都应明确迁移路径和兼容策略。

5. AI 功能需要与专业上下文深度结合
   - AI 助手已具备交互骨架，但真正有价值的能力依赖对当前构件参数、派生规则、3D 选择状态和规范依据的可访问性。

### 后续建议和优化方向

1. 建立结构规则测试
   - 为锚固长度、负筋分排、单排最大根数、4 肢箍筋、中部钢筋布置等规则增加单元测试。
   - 对典型梁跨和柱截面参数建立快照测试，防止后续 UI 调整改坏结构计算。

2. 收敛构件数据模型
   - 梳理 KL、L、WKL、XL、KZ 的共性参数和专有参数。
   - 明确项目文件 schema，并为导入旧版本项目增加迁移测试。

3. 强化 3D 与剖切面一致性
   - 抽取共享派生数据，避免 3D 视图、剖切面、数据面板各自计算。
   - 建议建立可视化回归样例，覆盖弯钩方向、分层错开、二排筋颜色、拉筋包绕等关键表现。

4. 完善 AI 助手闭环
   - 让助手读取当前构件参数和派生结果，生成可解释的优化建议。
   - 增加建议应用前的 diff / 预览机制，避免自然语言修改直接污染工程参数。
   - 将规范依据、计算过程和用户输入拆分展示，便于专业用户审查。

5. 清理临时与实验文件
   - 仓库历史中出现 `_check_*`、`stitch_` 等辅助文件，建议确认是否仍需保留。
   - 若仅用于一次性调试或视觉参考，后续可迁入 `docs/assets` 或从主代码路径移除。

6. 补齐 CI 质量门槛
   - 在现有 CI/CD 基础上加入 typecheck、lint、单元测试和构建产物检查。
   - 对 Node 版本、包管理器和部署目标写入 README 或开发文档，减少环境漂移。

### 已整理提交哈希

- `83f317a223db1f9eda3d7d0a8ab669232df2b1c8` feat: AI assistant - optimization toggle, remove API key gate, natural language input
- `9e534349592de251f57bf1f787cc37fe8b21d50a` feat: add landing page, back nav, section cut panel expand/resize
- `707943fae75376f1f848f9e64219fc2363461d87` feat: 梁标注系统 + 柱截面参数
- `68e482c45ebc926805ad89fa576be327d42c098a` feat: 弯钩自外向内分层错开
- `bc8358426c0dfcf6460964d446ed739f9fb5a62c` feat: 中部钢筋两腰均布/锚固优先直锚
- `dea543530ead07dd3301ea376c619fb166b44513` feat: 添加中部钢筋、剖切面开关、store v7
- `1f0fe29006e95f7cb2f08be80748901c3dfc2bf7` feat: 梁端柱节点合并、UI 重组
- `aeb1c0909771a908a6c119fd4d5e93fc35959943` 优化: 子菜单 + 模板化 + 准确性修复
- `4b97393d47d5c7d56bc4ae3ef46791476f6550e9` feat: multi-member architecture, KZ column module, project import/export, CI/CD, persist
- `cd5d866a7e1eafc90d5b57f5a389c161bf439bee` feat: redesign UI with Aero-Precision glassmorphic design system
- `7272d1071e04e5bd8eaad438fd2e7b24258bea98` fix(stirrup): rounded bends with hooks at top-right corner + 5d lap
- `e884212e6579ff23424e3b1c54a6256c5baa9929` feat: STEELCORE workstation UI, 22G101-1 codes, dark tonal layers
- `2d8c50fa4e7ace4f765a53d6872c76fb174ee0f8` feat: add 600x600 end columns extending 1m above/below beam
- `082c1c0462673b5740ef0e7634137f042beed8c8` ci: upgrade actions to native node 24 majors
- `55bab750f2d21a14f5100a11d5b8b8c4d153ed70` ci: force node 24 in actions to silence deprecation
- `73133d977345144499499152e7501612a1b614f8` feat: white bg, alternate stirrup hooks; deploy to tese
- `f4525d1c481172087d2d7d9ccb8c3405ebdc51eb` init: KL 3D rebar visualizer
