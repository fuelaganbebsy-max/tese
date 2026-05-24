# AI 平法学习助手 — 产品需求文档

> 项目：Alpha-7 / 框架梁 KL 平法 3D 可视化
> 文档版本：v2.0 — 重写版
> 日期：2026-05-24

---

## 1. 背景与问题描述

### 1.1 产品现状

Alpha-7（路径：`C:\Users\Administrator\CascadeProjects\tese`）是一个基于 React + Three.js 的纯前端工具，支持用户通过表单输入参数，实时生成基于 22G101 图集的钢筋骨架 3D 模型。当前覆盖**框架梁 KL**，按 **22G101-1** 自动计算锚固、弯钩、箍筋加密区，后续规划覆盖 22G101-2（板）和 22G101-3（基础）。

### 1.2 用户痛点

1. **理解门槛高** — 平法编号（N4C16、C8@100/200(2)、通长筋、架立筋）需要对照图集查阅释义，刚入行的结构工程师和土木学生面对一堆参数无从下手
2. **规则不透明** — 锚固长度、弯钩长度、箍筋加密区等计算逻辑完全隐藏在代码/图集中，用户无法交互式提问「为什么是这个值」
3. **学习路径缺失** — 目前的工具只提供 3D 展示和表单输入，没有任何教学引导或知识问答能力
4. **图集查阅不方便** — 22G101 图集共 3 册、数百页，即使是资深工程师查阅冷门构造也要翻半天

### 1.3 解决思路

在 Alpha-7 中嵌入一个**AI 平法学习助手侧边栏**，让用户直接在工具内以自然语言提问，获得基于 22G101 图集的解释、计算推理和构造建议。

### 1.4 战略价值

- **差异化**：市面钢筋 3D 可视化工具几乎没有内嵌教学 AI 的
- **降低门槛**：吸引结构实习生、高校土木学生用户群体
- **技术铺路**：AI 能力（规范条文 → 3D 高亮联动、智能参数推荐）可逐步加深
- **模型中立**：通过 Provider 模式支持国内主流模型，用户自带 API Key，避免合规/成本问题

---

## 2. 目标与成功指标

### 2.1 业务目标

在 Alpha-7 中集成 AI 平法学习助手，支持**至少 2 个国内主流模型**（DeepSeek、Kimi），通过侧边栏对话形式，让用户以自然语言获取平法相关知识。

### 2.2 成功指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 问答有效回复率 | > 85% | 用户提问后获得非空、无错误的平法相关回答 |
| 模型切换成功率 | 100% | 切换 DeepSeek / Kimi 后能正常对话（需正确 API Key） |
| 首字节响应时间 | < 5s | 用户发送消息到看到首个响应字符的时间 |
| 侧边栏不阻塞 3D 渲染 | 3D 帧率下降 < 10% | AI 面板展开时对 WebGL 性能影响可忽略 |
| 用户满意度（内测） | >= 4/5 | 至少 3 名结构工程师内测打分 |

---

## 3. 目标用户与使用场景

### 3.1 用户画像

| 画像 | 角色 | 目标 | 痛点 |
|------|------|------|------|
| **结构实习生** | 入行 1-2 年 | 快速查阅平法规则，理解钢筋构造 | 图集太厚不敢问师傅，效率低 |
| **高校学生** | 土木工程本科/研究生 | 学习梁柱配筋原理，辅助课程作业 | 没接触过实际项目的 22G101 应用 |
| **转行工程师** | 从其他领域转入结构设计 | 快速上手国内平法制图规则 | 缺乏国内规范体系基础 |
| **资深工程师** | 5 年以上结构设计 | 偶尔查阅冷门构造或复核计算 | 图集翻阅慢，需要快速确认 |

### 3.2 典型使用场景

| # | 场景 | 用户操作 | AI 期望行为 |
|---|------|---------|------------|
| A | **参数释义** | 用户看到表单里「N4C16」不理解 → 复制到 AI 助手 | 解释「N 为抗扭钢筋，4 根直径 16mm 的三级钢」 |
| B | **规则查询** | 用户问「框架梁端支座锚固长度怎么算」 | 引用 22G101-1 对应页码并给出公式 |
| C | **计算验证** | 用户问「当前梁箍筋加密区为什么是 1.5m」 | 结合当前构件参数（梁高、抗震等级）解释计算过程 |
| D | **构造建议** | 用户问「梁高 600 需要加腰筋吗」 | 根据 hw >= 450mm 规则给出建议，援引规范 |
| E | **术语对比** | 用户问「通长筋和贯通筋有什么区别」 | 清晰区分两个概念，举例说明 |
| F | **图集查表** | 用户问「C35 混凝土，HRB400，抗震三级，锚固长度多少」 | 查表给出 lae 值 |

---

## 4. 功能需求

### 4.1 对话界面（Assistant Chat UI）

| ID | 需求 | 优先级 | 说明 |
|----|------|--------|------|
| F-001 | AI 侧边聊天面板 | **P0** | 从右侧滑入的收窄侧边栏 320px 宽，不覆盖 3D 场景主区域 |
| F-002 | 消息输入框 | **P0** | 用户输入自然语言问题，回车发送，支持 Shift+Enter 换行 |
| F-003 | 消息气泡展示 | **P0** | 用户消息 / AI 回复分左右气泡，上下文对话列表可滚动 |
| F-004 | 流式响应 | **P1** | AI 回复逐字流式输出（SSE），营造实时对话感 |
| F-005 | 清空对话 | **P2** | 一键清除当前聊天气泡（带确认，防误触） |
| F-006 | 复制回复 | **P2** | 点击复制 AI 回复文本到剪贴板 |
| F-007 | 对话历史持久化 | **P3** | 页面刷新后保留最近 50 条对话（localStorage） |
| F-008 | 推荐问题快捷入口 | **P2** | 初始状态展示 3-5 个推荐问题卡片，点击快速提问 |
| F-009 | 加载/等待状态 | **P1** | 发送消息后输入框禁用，显示加载动画（Typing dots） |
| F-010 | 侧边栏开关按钮 | **P0** | 工具栏增加 AI 图标按钮，点击展开/收起；默认不展开 |
| F-011 | 正在输入指示器 | **P1** | AI 正在生成时显示「平法专家正在思考...」提示 |

### 4.2 模型管理与切换

| ID | 需求 | 优先级 | 说明 |
|----|------|--------|------|
| F-020 | 支持 DeepSeek 模型 | **P0** | 通过 DeepSeek Chat API 接入，作为默认模型选项 |
| F-021 | 支持 Kimi（月之暗面）模型 | **P1** | 通过月之暗面开放平台 API 接入，模型 moonshot-v1 |
| F-022 | 支持 Qwen（通义千问）模型 | **P1** | 通过阿里云百炼平台 API 接入，模型 qwen-plus/qwen-max |
| F-023 | 支持 GLM（智谱清言）模型 | **P1** | 通过智谱开放平台 API 接入，模型 glm-4-plus |
| F-024 | 支持 Doubao（豆包/火山引擎）模型 | **P2** | 通过火山引擎 API 接入，模型 doubao-pro |
| F-025 | 支持 Yi（零一万物）模型 | **P2** | 通过零一万物 API 接入，模型 yi-lightning |
| F-026 | 支持 Ernie（百度文心）模型 | **P2** | 通过百度千帆 API 接入，模型 ernie-4.0 |
| F-027 | 支持 360 智脑模型 | **P3** | 通过 360 智脑 API 接入 |
| F-028 | 支持 MiniMax 模型 | **P3** | 通过 MiniMax API 接入，模型 abab6.5 |
| F-029 | 模型下拉选择器 | **P1** | 侧边栏顶部下拉框，列出所有已接入模型 |
| F-030 | 自定义 API Key 配置 | **P0** | 每个模型独立配置 API Key，保存在 localStorage |
| F-031 | 模型切换对话保持 | **P1** | 切换模型时不丢失当前对话内容 |
| F-032 | 多模型扩展 Provider 架构 | **P1** | 前端抽象统一 Provider 接口，新模型只需实现一个文件 |
| F-033 | 模型显示名称可配置 | **P2** | 选择器支持显示模型别名，方便用户识别 |
| F-034 | 模型分组显示 | **P2** | 选择器中按「已配置 Key」「未配置 Key」「推荐」分组 |
| F-035 | 多个模型同时可用 | **P3** | 用户可同时配置多个模型的 Key，自由切换 |

### 4.3 平法知识引擎

| ID | 需求 | 优先级 | 说明 |
|----|------|--------|------|
| F-030 | 基础平法问答能力 | **P0** | AI 能回答 22G101-1/2/3 图集中的常见规则和构造问题 |
| F-031 | 标准 System Prompt | **P0** | 为每个模型设置固定的「平法专家」人设，回答风格一致 |
| F-032 | 上下文感知 | **P1** | AI 能结合当前 3D 构件的参数（梁宽、梁高、配筋等）回答问题 |
| F-033 | 规范引用清晰标识 | **P1** | 回答中引用 22G101 条文时标明图集编号 + 页码 |
| F-034 | 知识边界说明 | **P2** | AI 对非平法问题（如天气、闲聊）礼貌告知能力边界并引导回平法话题 |
| F-035 | 平法术语自动高亮 | **P3** | AI 回复中出现的平法专有名词自动高亮或 tooltip 释义 |

### 4.4 系统集成约束

| ID | 需求 | 优先级 | 说明 |
|----|------|--------|------|
| F-040 | 懒加载 | **P1** | AI 功能模块通过 React.lazy + Suspense 按需加载，不增加首屏体积 |
| F-041 | 不阻塞 3D 渲染 | **P1** | AI 面板独立渲染线程，不干扰 WebGL 帧率 |
| F-042 | 纯前端方案 | **P1** | 所有 AI 请求由浏览器直接发出，不引入后端代理服务 |
| F-043 | SSE/Abort 支持 | **P1** | 用户可中断正在生成的回复，浏览器原生 fetch AbortController |
| F-044 | CORS 兼容 | **P1** | 确认 DeepSeek API 和月之暗面 API 支持浏览器端直接调用（通常有 CORS 限制，需验证） |

> **注意 F-044**：国内大模型 API 通常没有 CORS 头（Access-Control-Allow-Origin），纯前端方案可能需要额外处理。备选方案见技术架构。

---

## 5. 非功能需求

| ID | 需求 | 目标值 | 优先级 |
|----|------|--------|--------|
| NF-001 | 首屏加载增量 | 懒加载后额外 JS < 100KB | P1 |
| NF-002 | 内存占用 | AI 面板展开时额外内存 < 50MB | P2 |
| NF-003 | 文档同步 | 实现后更新 README 使用说明 | P2 |
| NF-004 | 错误处理 | API 异常、网络断开时显示友好的错误提示 | P0 |
| NF-005 | 输入防抖 | 短时间连续发送不触发多次 API 调用 | P2 |
| NF-006 | 安全性 | API Key 仅存 localStorage，不上传、不落日志、不共享 | P0 |

---

## 6. UI/UX 需求

### 6.1 布局示意

```
┌───────────────────────────────────────────────────┐
│  3D 场景（主区域）           ┌───────────────┐    │
│                               │  AI 侧边栏   │    │
│                               │  (320px)      │    │
│                               │               │    │
│                               │  [模型选择器]  │    │
│                               │               │    │
│                               │  ┌─────────┐ │    │
│                               │  │推荐问题  │ │    │
│                               │  │·锚固怎么算│ │    │
│                               │  │·腰筋规则  │ │    │
│                               │  └─────────┘ │    │
│                               │               │    │
│                               │  ┌─────────┐ │    │
│                               │  │用户→...  │ │    │
│                               │  │←AI 回复..│ │    │
│                               │  └─────────┘ │    │
│                               │               │    │
│                               │  ─────────── │    │
│                               │  [输入框] ➤   │    │
│                               └───────────────┘    │
└───────────────────────────────────────────────────┘
```

### 6.2 交互细节

1. **侧边栏开关** — 工具栏 AI 图标按钮，点击展开/收起；首次访问默认收起
2. **收起时不销毁** — 切换回到对话保持状态，除非用户主动清空
3. **展开时 3D 场景自适应** — 主场景宽度自动缩小适配剩余宽度
4. **初始状态** — 显示推荐问题卡片 + 简短引导语（「问我任何平法问题」）
5. **模型选择器** — 侧边栏顶部下拉框，默认选 DeepSeek
6. **API Key 配置入口** — 模型选择器旁边齿轮图标，点击弹出配置框
7. **发送按钮状态** — 空输入时禁用灰色，输入内容后高亮可点击
8. **错误状态** — API Key 未配置时发送按钮置灰并显示 tooltip「请先配置 API Key」

### 6.3 视觉风格

- 延续项目现有 TailwindCSS 色调
- 侧边栏背景色：比主背景稍深（slate-800 / gray-800）
- 用户气泡：蓝色系（blue-600）
- AI 气泡：暗色系（slate-700）
- 规范引用文本：特殊底色高亮（amber-900 + 边框）
- 推荐问题卡片：带 hover 效果的可交互卡片

---

## 7. 技术架构

### 7.1 组件层次

```
src/ui/
├─ ai/                        # AI 助手模块（React.lazy 懒加载入口）
│  ├─ AssistantPanel.tsx       # 侧边栏容器（含开关动画）
│  ├─ ChatBubble.tsx           # 消息气泡（用户 & AI，含引用高亮）
│  ├─ InputBox.tsx             # 输入框组件（发送/换行/禁用状态）
│  ├─ ModelPicker.tsx          # 模型选择器 + API Key 配置
│  ├─ SuggestedQuestions.tsx   # 推荐问题卡片列表
│  ├─ aiStore.ts              # Zustand store（对话状态、模型配置、API Key）
│  └─ providers/
│     ├─ types.ts              # AIProvider 接口定义
│     ├─ deepseek.ts           # DeepSeek Provider 实现
│     └─ kimi.ts               # Kimi Provider 实现
```

### 7.2 Provider 接口

```typescript
interface AIProvider {
  name: string;
  displayName: string;

  /** 发送消息，返回完整回复（非流式） */
  chat(
    history: { role: 'user' | 'assistant'; content: string }[],
    systemPrompt: string,
    options?: { signal?: AbortSignal }
  ): Promise<string>;

  /** 流式发送，onChunk 逐段回调 */
  chatStream?(
    history: { role: 'user' | 'assistant'; content: string }[],
    systemPrompt: string,
    onChunk: (text: string) => void,
    options?: { signal?: AbortSignal }
  ): Promise<string>;
}
```

### 7.3 各 Provider 接入细节

所有模型均使用 OpenAI 兼容接口（/v1/chat/completions），统一采用 `stream: true` + SSE 流式方案。

#### DeepSeek

| 项目 | 值 |
|------|-----|
| 端点 | `https://api.deepseek.com/v1/chat/completions` |
| 默认模型 | `deepseek-chat` |
| 文档 | https://platform.deepseek.com/docs |
| API Key 获取 | https://platform.deepseek.com/api_keys |

#### Kimi / 月之暗面

| 项目 | 值 |
|------|-----|
| 端点 | `https://api.moonshot.cn/v1/chat/completions` |
| 默认模型 | `moonshot-v1-8k` |
| 备选模型 | `moonshot-v1-32k`、`moonshot-v1-128k` |
| 文档 | https://platform.moonshot.cn/docs |
| API Key 获取 | https://platform.moonshot.cn/console/api-keys |

#### Qwen / 通义千问（阿里云百炼）

| 项目 | 值 |
|------|-----|
| 端点 | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` |
| 默认模型 | `qwen-plus` |
| 备选模型 | `qwen-max`、`qwen-turbo` |
| 文档 | https://help.aliyun.com/zh/model-studio/ |
| API Key 获取 | https://bailian.console.aliyun.com/ |

#### GLM / 智谱清言

| 项目 | 值 |
|------|-----|
| 端点 | `https://open.bigmodel.cn/api/paas/v4/chat/completions` |
| 默认模型 | `glm-4-plus` |
| 备选模型 | `glm-4-0520`、`glm-4-air` |
| 文档 | https://open.bigmodel.cn/dev/api |
| API Key 获取 | https://open.bigmodel.cn/usercenter/apikeys |

#### Doubao / 豆包（火山引擎）

| 项目 | 值 |
|------|-----|
| 端点 | 需从火山引擎推理点获取，格式 `https://ark.cn-beijing.volces.com/api/v3/chat/completions` |
| 默认模型 | `ep-xxxx-xxxxx`（使用推理点 ID） |
| 文档 | https://www.volcengine.com/docs/82379 |
| API Key 获取 | 火山引擎控制台 → API Key 管理 |

#### Yi / 零一万物

| 项目 | 值 |
|------|-----|
| 端点 | `https://api.lingyiwanwu.com/v1/chat/completions` |
| 默认模型 | `yi-lightning` |
| 备选模型 | `yi-large`、`yi-medium` |
| 文档 | https://platform.lingyiwanwu.com/docs |
| API Key 获取 | https://platform.lingyiwanwu.com/api-keys |

#### Ernie / 百度文心

| 项目 | 值 |
|------|-----|
| 端点 | `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro`（需先获取 access_token） |
| 默认模型 | `ernie-4.0-8k` |
| 注意 | 百度千帆不直接支持 OpenAI 标准接口，需先通过 API Key + Secret Key 换取 access_token |
| 文档 | https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Fm2vrveyu |
| API Key 获取 | https://console.bce.baidu.com/iam/ |

#### MiniMax

| 项目 | 值 |
|------|-----|
| 端点 | `https://api.minimax.chat/v1/text/chatcompletion_v2` |
| 默认模型 | `abab6.5s` |
| 备选模型 | `abab6.5`、`abab5.5` |
| 文档 | https://platform.minimaxi.com/document/ChatCompletion%20v2 |
| API Key 获取 | https://platform.minimaxi.com/ |

#### 360 智脑

| 项目 | 值 |
|------|-----|
| 端点 | `https://api.360.cn/v1/chat/completions` |
| 默认模型 | `360gpt2-pro` |
| 文档 | https://ai.360.cn/platform/docs/overview |
| API Key 获取 | https://ai.360.cn/platform |

#### Provider 统一接口

每个 Provider 实现以下接口：

```typescript
interface AIProviderConfig {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  apiEndpoint: string;
  docsUrl: string;
}

interface AIProvider {
  config: AIProviderConfig;
  chat(
    history: { role: 'user' | 'assistant'; content: string }[],
    systemPrompt: string,
    apiKey: string,
    options?: { model?: string; signal?: AbortSignal }
  ): Promise<string>;
  chatStream?(
    history: { role: 'user' | 'assistant'; content: string }[],
    systemPrompt: string,
    apiKey: string,
    onChunk: (text: string) => void,
    options?: { model?: string; signal?: AbortSignal }
  ): Promise<string>;
}
```

所有 Provider 以文件形式存放在 `src/ui/ai/providers/` 目录，每个文件导出 `providerConfig` 和 `createProvider()`。

### 7.4 CORS 问题与解决方案

国内大模型 API 对浏览器端直接调用的 CORS 支持情况不一。以下逐一评估：

| 模型 | API 端点 | CORS 头 | 纯前端调用 |
|------|---------|---------|-----------|
| DeepSeek | `api.deepseek.com` | 有 ✅ | 可行 |
| Kimi（月之暗面） | `api.moonshot.cn` | 未知 ❓ | 需测试 |
| Qwen（阿里云百炼） | `dashscope.aliyuncs.com` | 可配置 ⚠️ | 需在控制台开启 |
| GLM（智谱） | `open.bigmodel.cn` | 未知 ❓ | 需测试 |
| Doubao（火山引擎） | `ark.cn-beijing.volces.com` | 未知 ❓ | 需测试 |
| Yi（零一万物） | `api.lingyiwanwu.com` | 未知 ❓ | 需测试 |
| Ernie（百度文心） | `aip.baidubce.com` | 无 ❌ | 不可行（需后端代理） |
| MiniMax | `api.minimax.chat` | 未知 ❓ | 需测试 |
| 360 智脑 | `api.360.cn` | 未知 ❓ | 需测试 |

**解决方案（按推荐优先级）：**

1. **仅支持 CORS 友好的模型（Phase 1）** — DeepSeek 已确认支持 CORS，可以作为默认模型
2. **Vercel/Netlify Serverless Function 代理（Phase 2）** — 在 Vercel 部署一个轻量代理，转发到不支持 CORS 的 API
3. **CORS Anywhere 中间件（备选）** — 使用公开或自建的 CORS 代理服务
4. **浏览器插件模式（远期）** — 如果产品形态转型为浏览器插件，Chrome 扩展的请求不受 CORS 限制

> **建议**：Phase 1 先只接入 DeepSeek，Phase 2 扩展时根据实测结果逐步接入其他模型。

### 7.5 System Prompt（核心）

```
你是一名精通中国建筑结构平法图集（22G101-1、22G101-2、22G101-3）的专家。

你的职责是：
1. 帮助用户理解平法图纸中的钢筋编号、构造规则和计算公式
2. 引用规范时明确标明图集编号和页码（如「22G101-1 第 2-34 页」）
3. 回答简洁、准确、专业。根据问题深度适当展开，不啰嗦
4. 如果用户提问涉及具体构件的参数，结合参数进行计算解释
5. 对于超出平法/结构工程范围的问题，礼貌告知无法回答，并引导回相关话题
6. 遇到不明确的描述时，先基于标准规范解释，再指出可能的例外情况

当前构件参数（可用 JSON 格式注入）：
{beamParams}
```

> 注：`{beamParams}` 占位符在运行时替换为当前构件的实际参数（梁宽、梁高、配筋、抗震等级等），实现上下文感知。

---

## 8. 边界情况与错误状态

| 场景 | 预期行为 |
|------|----------|
| API Key 未配置 | 输入框置灰 + tooltip「请先配置 API Key」，不发送请求 |
| API Key 错误/过期 | 显示红色错误提示「API Key 无效，请检查后重新配置」 |
| API 请求超时（> 30s） | 显示「请求超时，请重试」 |
| 网络断开 | 显示「网络已断开」，已有的对话不丢失 |
| API 返回空响应 | 显示「未获取到回答，请重新提问」 |
| 用户输入空消息 | 发送按钮禁用，点击不触发 |
| 用户输入超长（> 4000 字符） | 截断并提示「输入过长，已截断至 4000 字符」 |
| 连续快速发送 | 防抖处理，前一个请求未完成时禁用发送 |
| 切换模型 | 当前对话不丢失，新消息使用新模型处理 |
| 侧边栏收起/展开动画过程中 | 收起时不销毁状态，展开时保持上次位置 |
| 用户中断生成（Abort） | 立即停止流式输出，聊天记录保留已生成部分 |

---

## 9. 待定问题

| # | 问题 | 状态 |
|---|------|------|
| 1 | **CORS 处理方案** — DeepSeek / Kimi API 是否支持浏览器端直接调用？是否需要引入代理？ | **需验证** |
| 2 | **API Key 安全策略** — 纯 localStorage 存储是否足够？是否需要加密存储？ | **待讨论** |
| 3 | **API Key 引导流程** — 首次使用是否弹出配置引导？如何降低用户配置门槛？ | **待讨论** |
| 4 | **上下文感知的深度** — 是简单注入参数 JSON，还是需要实时拉取完整构件状态？ | **待讨论** |
| 5 | **离线 fallback** — 是否提供预设的离线知识库（纯本地问答）作为无网络时的降级方案？ | **待讨论** |
| 6 | **聊天 token 消耗** — 对话历史增长后 token 过多，是否自动截断早期消息？ | **待讨论** |
| 7 | **是否支持多轮上下文** — 支持多少轮历史？（参考值：建议保留最近 10 轮对话） | **待讨论** |
| 8 | **平台扩展** — 后续是否支持通过 ollama 接入本地模型（如 Qwen 本地版）？ | **待讨论** |

---

## 10. 发布计划

### Phase 1（MVP）— 基础对话可用

| 需求 | 工作量估算 | 说明 |
|------|----------|------|
| F-001 侧边聊天面板 | 中 | 面板 + 动画 + 容器布局 |
| F-002 消息输入框 | 小 | 输入 + 发送按钮 + 换行逻辑 |
| F-003 消息气泡展示 | 小 | 左右气泡组件 + 滚动容器 |
| F-010 侧边栏开关按钮 | 小 | 工具栏图标 + 展开/收起 |
| F-020 DeepSeek 模型接入 | 中 | Provider + API 调用 |
| F-030 API Key 配置 | 中 | 配置弹窗 + localStorage 存取 |
| F-029 模型选择器（基础版） | 小 | 下拉框 UI（先仅 DeepSeek） |
| F-031 System Prompt | 小 | 标准平法专家人设 |
| F-040 懒加载 | 小 | React.lazy 按需加载 |
| NF-004 错误处理 | 中 | 各错误状态 UI + 提示文案 |

**估算总工时：3-5 人天**

- 只接入 DeepSeek（已知 CORS 友好）
- 单 Key 配置，基础问答 + 流式回复
- 部署方案：GitHub Pages + 原生 Fetch

### Phase 2 — 模型扩展

| 需求 | 工作量估算 | 说明 |
|------|----------|------|
| F-004 流式响应 | 中 | SSE 解析 + 逐字渲染 |
| F-021 Kimi 模型接入 | 中 | Provider + CORS 验证 |
| F-022 Qwen 模型接入 | 中 | Provider + CORS 验证 |
| F-023 GLM 模型接入 | 中 | Provider + CORS 验证 |
| F-032 Provider 架构 | 中 | 抽象接口 + 工厂模式 |
| F-029 完整模型选择器 | 小 | 多模型分组下拉 |
| F-031 模型切换对话保持 | 小 | 切换不丢 state |
| F-008 推荐问题 | 小 | 卡片列表 |
| F-009 加载/等待状态 | 小 | Typing dots |

**估算总工时：4-6 人天**

- 根据实测 CORS 情况，选择性接入 2-3 个模型
- 对不支持 CORS 的模型启动 Serverless 代理方案
- 如果 CORS 问题无法解决，改走 Vercel 代理

### Phase 3 — 更多模型 + 深度集成

| 需求 | 工作量估算 | 说明 |
|------|----------|------|
| F-024 Doubao 模型接入 | 中 | Provider 实现 |
| F-025 Yi 模型接入 | 中 | Provider 实现 |
| F-026 Ernie 模型接入 | 中 | 注意百度非标准接口 |
| F-027 360 智脑接入 | 中 | Provider 实现 |
| F-028 MiniMax 接入 | 中 | Provider 实现 |
| F-034 模型分组显示 | 小 | 按 Key 配置状态分组 |
| F-035 多模型同时可用 | 小 | 每个模型独立 Key |
| F-032 上下文感知 | 中 | 构件参数注入 Prompt |
| F-033 规范引用标识 | 小 | 高亮样式 |
| F-005 清空对话 | 小 | 确认弹窗 |
| F-006 复制回复 | 小 | 剪贴板 API |
| F-007 对话历史持久化 | 小 | localStorage |
| F-011 正在输入指示器 | 小 | 状态文案 |
| NF-001/NF-002 性能优化 | 中 | 包体积分析 + 优化 |

---

## 11. 附录 — 与旧版 PRD 的差异说明

本 v2.0 文档对原始 v1.0 PRD（docs/PRD-AI-Pingfa-Assistant.md）做了以下改进：

1. **纠正了 Phase 标记** — 原文档将所有需求标记为已实现（[x]），实际上项目中没有 AI 相关代码。v2.0 统一修改为规划阶段标记。
2. **补充了 CORS 问题** — 原文档遗漏了纯前端调用国内 API 的关键技术障碍，v2.0 单列一节分析并给出方案。
3. **补充了 API Key 配置入口的交互细节** — 原文档缺少配置入口的描述。
4. **增加了 F-044 CORS 兼容需求** — 作为 P1 需求纳入规划。
5. **修复了需求编号体系** — 原文档编号略显混乱（F-001 在前，F-010 在后穿插 F-004 等），v2.0 按模块分组重新编号。
6. **增加了输入防抖、API Key 安全性等非功能需求**。
7. **补充了各 Provider 的接入细节**（API 端点、模型名、文档链接）。
8. **增加了工作量估算** — 每个 Phase 给出人天估算，方便排期。
9. **补充了推荐问题、正在输入指示器等交互细节**。
10. **Bug 修复** — 原文档部分需求描述含糊（如「流式回复」仅列 ID），v2.0 补充了具体说明。
