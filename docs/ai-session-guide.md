# 第 4 题二档「桌宠」：网页 AI 会话操作指南

## 技术选型

- 桌面应用：Electron + HTML/CSS/JavaScript
- 理由：真正常驻桌面，支持透明无边框窗口、鼠标拖拽、点击交互；不需要安装额外编译器。
- 不使用 Cursor / Claude Code / Copilot 等直接读写项目文件的 agent 工具。

## 目录规划

```text
openlab-pet/
├─ package.json
├─ README.md
├─ src/
│  ├─ main.js          Electron 主进程：窗口、托盘、IPC
│  ├─ preload.js       暴露受控 API
│  └─ renderer/
│     ├─ index.html
│     ├─ style.css
│     ├─ pet.js        桌宠状态机与交互
│     └─ assets/       图片、音效
└─ docs/
   ├─ ai-session-guide.md
   ├─ conversation.md  会话链接与关键问答摘录
   └─ modules.md       三个关键模块说明
```

## 操作原则

1. 始终在同一个网页 AI 会话里提问，不要新开。
2. AI 每次给出文件时，你完整粘贴到对应路径。
3. 每次改完先运行，把真实报错原样贴回 AI。
4. 不要一次让 AI 生成整个项目，按下面的阶段提交，便于留下“为什么这样问”的记录。

## 可参考的开源项目

下面这些项目是真实存在的，可以直接打开看目录、窗口设置和交互实现。

| 项目 | 技术栈 | 适合参考什么 |
| --- | --- | --- |
| [chaozhongliu/DyberPet](https://github.com/ChaozhongLiu/DyberPet) | Python / DPG | 桌宠窗口动画、随机行为更新 |
| [kirbystudy/chatgpt-desktopPet](https://github.com/kirbystudy/chatgpt-desktopPet) | Electron / JavaScript | Electron 透明窗口与 Live2D 接入 |
| [OpenPetsHQ/openpets](https://github.com/OpenPetsHQ/openpets) | Electron / TypeScript | 插件化结构、桌宠状态管理 |
| [liupig/xiaokeai](https://github.com/liupig/xiaokeai) | Python / 3D | 透明桌宠、动作与语音，适合看产品形态 |
| [JianguSheng/yuns-desktop-pet](https://github.com/JianguSheng/yuns-desktop-pet) | Electron / JavaScript | 多模型对话、桌面交互整体架构 |
| [NanmiCoder/cc-haha](https://github.com/NanmiCoder/cc-haha) | Electron / TypeScript | 大型项目如何拆主进程、渲染进程与预制服务 |

参考项目只用来回答“成熟实现怎么组织”，不要把它们的代码整段搬进作业。下面的提问脚本会让 AI 逐文件生成适合你项目的代码，老师也能从 Git 历史里看到你的迭代过程。

---

## 第一轮：确定方案与最小可运行版本

把下面整段发给 AI：

```text
我在参加一个大学实验室的编程笔试，需要开发一个桌面宠物（桌宠），要求：
1. 常驻桌面，有界面；
2. 支持点击、拖拽、说话、走动；
3. 使用 Electron + HTML/CSS/JavaScript；
4. 运行环境是 Windows 11，Node.js 24；
5. 不允许使用 Cursor、Copilot 之类的 agent 工具代写，我会手动把代码粘贴成文件；
6. 项目结构要规范，代码要模块化，方便我向老师解释。

请先不要写代码。请给我：
- 一个最小可行版本的功能清单；
- 需要创建的文件及每个文件的职责；
- 推荐的窗口方案（透明、无边框、置顶、透明区域点击穿透如何处理）；
- 拖拽和“走动”分别适合用什么实现方式，并说明为什么。
回答控制在 600 字以内，不要给出冗长教程。
```

你要做：读完回答，把方案复制到 `docs/conversation.md`，并写下你为什么这样问，例如“先约束技术栈和交付边界，避免 AI 一次生成不可维护的大项目”。

如果 AI 建议 `BrowserWindow` 的 `transparent: true` 加 `frame: false`，这个方向是对的。正常交互应先关闭 `ignoreMouseEvents`，否则点击会穿透到桌面。

---

## 第二轮：项目骨架与启动

```text
按刚才确定的方案，帮我搭建最小可运行版本。

请分文件给出完整代码，路径使用以下结构：
package.json
src/main.js
src/preload.js
src/renderer/index.html
src/renderer/style.css
src/renderer/pet.js

要求：
1. 窗口 220x220，无边框、透明、置顶、任务栏不显示；
2. 渲染进程不能直接使用 Node API，contextIsolation 必须开启；
3. 先实现静态显示一个圆角宠物形象，不需要图片素材；
4. package.json 加上 npm start 脚本；
5. 说明在 PowerShell 里从零安装和启动的命令。

每个文件单独用代码块给出，并在代码块上方写清完整路径。不要省略任何代码，不要写“其余保持不变”。
```

你要做：按路径逐个创建文件，执行：

```powershell
cd D:\openlab\openlab-pet
npm install
npm start
```

如果窗口不出现或终端报错，把完整报错贴回同一个会话，继续问：

```text
运行 npm start 后出现以下错误，请只针对这个错误给出修复，并说明错误原因：
（粘贴完整报错）
```

---

## 第三轮：拖拽与点击

```text
现在实现桌宠交互，保持上一轮的文件结构：

1. 按住宠物可以拖拽整个窗口；
2. 单击宠物时切换一个“被摸到”的开心表情，并在 1 秒后恢复；
3. 拖拽和单击要能区分：拖动超过 5 像素算拖拽，不触发单击；
4. 窗口位置要限制在屏幕可见范围内；
5. 所有鼠标事件只在宠物区域监听，不拦截整个桌面的点击。

请给出需要修改或新增的完整文件，不要只给片段。说明每个事件监听器绑定在哪个元素上，以及 IPC 数据怎么从渲染进程传到主进程。
```

这一轮的关键是“区分拖拽和点击”。常见错误是用 `mousedown` 直接触发点击，或者用 CSS `-webkit-app-region: drag`，后者会吞掉点击事件。应该用 pointer 事件记录起点和位移。

---

## 第四轮：随机走动与说话气泡

```text
继续扩展桌宠：

1. 每 8 到 15 秒随机走动一次，往左或往右移动 40 到 120 像素；
2. 走动时播放简单的左右摆动动画；
3. 走到屏幕边缘时自动掉头；
4. 每 20 到 40 秒随机说一句话，显示在宠物头顶的气泡里，3 秒后消失；
5. 台词至少有 8 句，放在单独的数组里，方便修改；
6. 所有定时器在窗口关闭时清理，避免进程残留。

请给出完整改动文件，并解释状态机有哪几个状态、状态之间如何切换。不要引入外部动画库。
```

你要做：跑起来观察 1 分钟，确认走动、掉头、气泡都正常。截图至少包含宠物和气泡。

---

## 第五轮：持久化（扩展任务）

```text
在同一个项目里增加持久化：

1. 记住窗口最后一次的位置、宠物当前朝向、累计被点击次数；
2. 关闭程序再打开，位置和计数要恢复；
3. 配置文件放在 app.getPath('userData') 下，文件名 pet-state.json；
4. 写入失败不能让程序崩溃，要捕获异常并记录日志；
5. 不要用第三方存储库。

请给出完整文件改动，说明读取和写入分别发生在哪些时机，以及为什么不能在渲染进程直接写文件。
```

注意：如果直接在主进程里用 `writeFileSync`，每次拖拽结束都写一次就够了，不要每帧写入。

---

## 第六轮：让它更像一个能交付的项目

```text
现在帮我做一次代码审查，目标是能交给老师检查。

请检查：
1. 渲染进程是否还残留直接访问 Node 的代码；
2. IPC 是否只暴露必要接口；
3. 定时器、事件监听是否都在退出时清理；
4. 窗口越界、状态文件损坏、重复启动这几种异常是否有处理；
5. 代码目录是否清晰。

按“问题 / 原因 / 修法 / 涉及文件”的表格输出，然后给出需要修改的完整文件。
```

这一轮能让答卷里的“说清 AI 哪里写错了”有真实材料。

---

## 第七轮：README 与模块说明

```text
根据目前最终代码，帮我写 README.md 和一份模块说明。

README 需要包含：项目简介、功能列表、技术栈、目录结构、安装与启动、操作方式、已知限制。
模块说明挑三个关键模块：
- Electron 主进程与窗口管理；
- 渲染进程的桌宠状态机；
- 持久化存储。
每个模块用两三句话说明作用、数据从哪里来、到哪里去。

请直接给 Markdown 全文，不要用“自行补充”之类的占位内容。
```

---

## 第八轮：生成提交材料清单

```text
帮我整理第 4 题提交清单，包含：
1. 会话分享链接要放在哪里；
2. 需要截哪些运行效果图；
3. 录屏应该展示哪三个动作；
4. Git 提交应该分成哪几次；
5. 需要在 README 里补充哪些截图引用。

用检查表形式输出，不要重复项目功能说明。
```

---

## 你还需要自己做的事

1. 在网页 AI 里点击“分享”，保存会话链接，填进 `docs/conversation.md`。
2. 从对话里挑两三轮关键问答，记录“为什么这样问、AI 是否答错、你怎么发现”。
3. 截图：窗口正常显示、拖拽中、气泡出现、重启后状态恢复。
4. 录屏 30 到 60 秒，依次展示拖拽、点击、走动、关闭再打开。
5. 在 `src/renderer/assets/` 放自己的宠物素材；没有素材时先用 CSS 画，也符合要求。
6. 按阶段提交 Git：

```powershell
git add package.json src docs
git commit -m "feat: 实现可拖拽桌宠基础版"
git add .
git commit -m "feat: 增加随机走动、气泡与持久化"
git push
```

## 不要做的事

- 不要把整个项目一次性丢给 AI，否则很难回答“AI 在哪一步卡住”。
- 不要让 AI 使用 `nodeIntegration: true`，这是 Electron 常见安全错误。
- 不要用真实的桌面点击穿透覆盖底层按钮，宠物窗口只应占据自身区域。
- 不要把 `node_modules/` 提交进仓库，仓库里已有 `.gitignore`。
- 不要伪造会话链接或截图。
