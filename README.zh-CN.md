<p align="center">
  <img src="docs/assets/app-preview.png" alt="OwnChat 界面" width="920">
</p>

<h1 align="center">OwnChat</h1>

<p align="center">
  <b>一个窗口，管住你所有的 AI 模型。本地优先 · 无需注册 · 零遥测。</b><br>
  每个会话独立绑定自己的接口、模型与人格。
</p>

<p align="center">
  <a href="https://github.com/KovacBro/OwnChat/releases/latest"><img src="https://img.shields.io/github/v/release/KovacBro/OwnChat?label=下载&style=for-the-badge&color=15AC70" alt="下载"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-15AC70?style=for-the-badge" alt="License"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-0078D4?style=for-the-badge" alt="平台">
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="#安装">安装</a> ·
  <a href="#接上你自己的模型">接口配置</a> ·
  <a href="#常见问题">常见问题</a> ·
  <a href="ROADMAP.md">路线图</a>
</p>

---

## 这是什么

OwnChat 是一个面向 Windows 的桌面 AI 聊天客户端，给那些**本来就同时用好几家模型**的人用。
新建一个会话，绑定一个接口、一个模型、一个人格；之后随便切换模型，历史一条都不会乱。

它完全跑在你自己的机器上：本地只监听 `127.0.0.1`，API Key 加密落盘，不需要任何云端账号。

## 为什么用它

**一个窗口管所有模型。** 求索、百炼、方舟、OpenRouter、Gemini、Groq、硅基流动、智谱、ModelScope、Mistral、
Cerebras、GitHub Models、Azure OpenAI、本地 Ollama，或者任何 OpenAI 兼容地址。
每个会话各自记住 `接口 + 模型 + 人格`——写代码的会话和翻译的会话互不干扰。

**真的本地。** 没有账号、没有埋点、没有崩溃上报。Key 用 AES-256-GCM 加密，
前端永远只拿到 `hasKey`。服务只绑定 `127.0.0.1`。

**很轻。** 不打包 Electron 运行时，直接用 Windows 上已有的 Edge 引擎开一个无边框应用窗口。
纯原生 JS，零 npm 依赖。

**可以自己查。** AGPL-3.0，代理层和存储层都摊开给你看，不认同某个设计就直接 fork。

## 当前状态

`0.2.x` 是早期版本，数据格式在 `1.0.0` 之前仍可能调整，跨小版本升级前请先导出。
目前只支持 Windows。安装包**暂未做代码签名**，首次运行可能出现"未知发布者"提示，
请核对 Release 里的 `SHA256SUMS.txt`。

覆盖安装会保留 `data/`；**卸载也不会删除 `data/`**，想彻底清空请手动删除该目录。

## 安装

### Windows 安装包（推荐）

1. 打开 **[Releases](https://github.com/KovacBro/OwnChat/releases/latest)**；
2. 下载 `OwnChat-<版本>-win64-setup.exe`；
3. 双击安装，装到 `%LOCALAPPDATA%\Programs\OwnChat`，不需要管理员权限；
4. 从开始菜单启动 **OwnChat**。

安装包已内置 Node.js，不用另外装环境。

> 国内访问 GitHub 较慢时，可从仓库主页的镜像链接下载。

### 便携版

下载 `OwnChat-<版本>-win64-portable.zip`，解压后运行 `start.bat`
（或 `start.vbs`，无黑框启动）。

### 从源码运行

```powershell
git clone https://github.com/KovacBro/OwnChat.git
cd OwnChat
node server.js
```

需要 Node.js 22+ 和 Microsoft Edge。

## 接上你自己的模型

OwnChat **不带任何 Key，也不提供额度**。你接自己已经付费的接口，或者自己注册的免费额度。

| 平台 | Base URL | Key |
|---|---|---|
| **求索**（DeepSeek） | `https://api.deepseek.com/v1` | 需要 |
| **百炼**（阿里云） | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 需要 |
| **方舟**（火山引擎） | `https://ark.cn-beijing.volces.com/api/v3` | 需要 |
| OpenRouter | `https://openrouter.ai/api/v1` | 需要 |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/` | 需要 |
| Groq | `https://api.groq.com/openai/v1` | 需要 |
| 硅基流动 | `https://api.siliconflow.cn/v1` | 需要 |
| 智谱 BigModel | `https://open.bigmodel.cn/api/paas/v4` | 需要 |
| ModelScope | `https://api-inference.modelscope.cn/v1` | 需要 |
| Mistral | `https://api.mistral.ai/v1` | 需要 |
| Cerebras | `https://api.cerebras.ai/v1` | 需要 |
| GitHub Models | `https://models.github.ai/inference` | GitHub Token |
| Ollama（本地） | `http://127.0.0.1:11434/v1` | 不需要 |
| 自定义 / Azure | 任意 OpenAI 兼容地址 | 可选 |

### 三个国内预设

它们**不绑定人格**——没有头像、没有角色设定，点一下就用默认助手开一个会话。

| 预设 | 定位 | 说明 |
|---|---|---|
| **求索** | 通用对话、写作、翻译 | DeepSeek 官方接口，`deepseek-chat` / `deepseek-reasoner` |
| **百炼** | 长文档、图片、企业级调用 | 通义千问全系：`qwen-plus`、`qwen-max`、`qwen-vl` |
| **方舟** | 豆包系列、角色与语音 | 先在方舟控制台建「推理接入点」，模型名填 `ep-…` 那个 ID |

每个接口卡片都能展开完整参数：上下文窗口、最大输出、温度、Top P、自定义请求头与请求体、
超时、视觉能力开关、测试连接、拉取模型列表。

免费额度和模型 ID 变化很快，以各家控制台为准。OwnChat 不内置任何 Key，也不承诺"永久免费"。

## 隐私

```text
data/
  index.json               设置、接口、人格、会话索引
  conversations/<id>.json  每个会话的消息
  uploads/                 聊天图片
  avatars/                 生成或上传的头像
  .master-key              本机随机密钥（AES-256-GCM）
  edge-profile/            Edge 应用窗口的用户目录
```

- API Key 加密存储；前端只拿 `hasKey`，不拿明文；
- 导出默认不含 Key；
- 无云同步、无遥测、无崩溃上报；
- 本地应用层加密不能替代 Windows 凭据管理器，无法防御管理员级攻击者。

你的提问和回答只会发往**你自己配置的接口**。如果用境外端点，数据会离开你的机器——
这是你自己的选择，App 不会替你做决定，也不会隐瞒。

## 进阶：WorkBuddy 本地接入

如果你已经装了 WorkBuddy 桌面端和 `dsh-connect-workbuddy` 插件，OwnChat 可以读取该插件
**已有的本地凭据**并复用其模型目录。它不注册账号、不经过我们的服务器中转、不上传任何凭据。

OwnChat 与 WorkBuddy、腾讯无隶属关系，**不提供、不转售、不共享**任何第三方订阅、额度或账号。
请仅在你依约有权使用的账号上使用。

## 企业 / 私有化

OwnChat 是单进程本地应用，天然适合没有外网出口的内网环境：指向内网的 OpenAI 兼容网关或本地
Ollama 即可，聊天数据不出机器。

团队版（统一策略管控、人格包下发、审计日志、离线模型管理）在开发中。
如果要在组织内评估 OwnChat，可以开一个 Discussion，或发邮件到仓库主页的地址。

## 截图

| 浅色 | 深色 |
|---|---|
| ![聊天](docs/assets/shots/app-light-chat.png) | ![聊天·深色](docs/assets/shots/app-dark-chat.png) |
| ![接口](docs/assets/shots/app-light-providers.png) | ![接口·深色](docs/assets/shots/app-dark-providers.png) |

更多（人格页、设置页，明暗两套）：[`docs/assets/shots/`](docs/assets/shots)

## 常见问题

**要注册账号吗？** 不用。没有登录、没有设备数限制。

**我的数据去哪了？** 只去你自己配置的接口，见[隐私](#隐私)。

**有代码签名吗？** 还没有。SmartScreen 可能提示"未知发布者"，请核对 `SHA256SUMS.txt`。
签名计划在 `1.0.0` 做。

**断网能用吗？** 能，配合 Ollama 或任何本地 OpenAI 兼容服务。

**为什么用 AGPL？** 防止有人拿它改一改就闭源转卖；个人使用、修改、自建都不受影响。

**有 Mac / Linux 版吗？** 暂时没有计划。本地服务本身是跨平台的，外层壳目前只做 Windows。

## 路线图

见 [ROADMAP.md](ROADMAP.md)。0.2.0 的主题是"可靠日用"：账号与区域状态、按模型配置能力、
重试与错误诊断、搜索与导出、深色主题、保留数据的升级。

**语音不在路线图内。**

## 参与

欢迎提 Issue 和 PR，请先读 [CONTRIBUTING.md](.github/CONTRIBUTING.md)。
安全问题请看 [SECURITY.md](.github/SECURITY.md)。

## 许可

[AGPL-3.0-or-later](LICENSE) © 2026 KovacBro。

`v0.1.0` 及更早版本以 MIT 发布，该授权不可撤回，对这些 tag 继续有效；
自 `0.2.0` 起项目改用 AGPL-3.0。

OwnChat 与 WorkBuddy、腾讯、DeepSeek、智谱及任何模型厂商均无隶属关系。
文中出现的第三方名称归各自权利人所有。

<!-- TODO: 换掉首屏截图（当前截图里带有厂商字样），并补一段 10 秒演示 GIF。 -->
