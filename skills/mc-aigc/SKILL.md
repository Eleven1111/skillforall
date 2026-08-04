---
name: mc-aigc
description: AIGC 内容生成技能。以商业化目标为驱动，输出 AI 图片和 AI 视频的精准生成 Prompt、品牌视觉指令体系、素材矩阵规划和平台适配方案。让 AI 生成物符合品牌调性而非千篇一律，直接对接 Midjourney、Flux、Kling、Sora、Runway 等主流 AIGC 工具。
---

## 触发条件

当用户提到以下任意情形时使用本技能：

- "AIGC" / "AI 生图" / "AI 视频" / "用 AI 做素材"
- "Midjourney prompt" / "Flux 怎么写提示词" / "Stable Diffusion 参数"
- "Kling / Sora / Runway / Pika 视频生成"
- "AI 做品牌图片" / "AI 广告素材" / "AI 产品图"
- "帮我写生图提示词" / "帮我生成视频脚本 + prompt"
- "素材不够用，用 AI 批量生成"
- "AI 生成的内容怎么保持品牌一致性"
- "小红书封面图 / 抖音封面 / 广告 banner 用 AI 做"

---

## 为什么 AIGC 需要专门的技能

大多数人用 AIGC 工具的方式是：随便写几个词 → 生成 → 挑一张还行的。

结果是：素材风格飘忽不定，跟品牌毫无关系，放到广告里显得突兀，用到内容里没有辨识度。

mc-aigc 解决的是：

1. **品牌一致性** — 将品牌视觉语言翻译成 AI 工具可以执行的精准 Prompt 体系
2. **商业化目标驱动** — 不是"生成好看的图"，而是"生成能提升转化率/点击率/品牌认知的图"
3. **素材矩阵规划** — 一次规划出覆盖全渠道的素材需求，系统化生产
4. **工具适配** — 不同工具有不同的 Prompt 逻辑，给对才能出对

---

## 工作方式

1. 确认生成目标：
   - **素材类型**：静态图片 / 动态视频 / 混合
   - **商业用途**：广告投放 / 内容种草 / 产品展示 / 品牌形象 / 包装视觉
   - **目标平台**：小红书 / 抖音 / TikTok / Instagram / Amazon / 独立站
   - **工具偏好**：Midjourney / Flux / SD / Kling / Runway / Sora / Pika / 混用
2. 读取 `brief.md`、`insight.md`、`product.md`、`content.md`（如存在）作为输入
3. 产出写入 `campaigns/{project-slug}/aigc.md`

---

## 模块 1：品牌视觉语言系统（Prompt 基础层）

所有 AIGC 生成的起点：把品牌视觉语言翻译成 AI 可执行的语法。

### 品牌视觉关键词库构建

```markdown
## 品牌视觉语言系统

### 风格底色（Style Foundation）
- 整体美学方向：{如 "clean minimal" / "warm earthy tones" / "high-contrast editorial" / "soft pastel lifestyle"}
- 时代感：{现代简约 / 复古胶片 / 未来科技 / 自然有机}
- 情绪温度：{温暖亲切 / 冷静专业 / 活力青春 / 奢华高冷}

### 色彩系统（Color System）
- 主色：{色彩描述，如 "warm ivory #F5F0E8"}
- 辅色：{色彩描述}
- 禁用色：{不能出现的颜色}
- 光影偏好：{柔光漫射 / 硬光侧打 / 逆光 / 自然光}

### 构图偏好（Composition）
- 画面关系：{居中对称 / 三分法 / 留白大 / 满版密集}
- 景深：{浅景深虚化 / 全清晰 / 微距特写}
- 视角：{俯视平铺 / 平视人眼 / 仰视赋权 / 45°斜俯}
- 留白方向：{上方留白（适合文字叠加）/ 左侧 / 右侧 / 均衡}

### 人物风格（若需要人物）
- 人种/肤色倾向：{根据目标市场}
- 年龄段：{20-25 / 25-35 / 35-45}
- 形象气质：{自然生活化 / 精英专业 / 青春活力 / 素人真实感}
- 妆容风格：{裸妆 / 精致妆 / 运动清爽 / 无妆素颜}
- 禁忌：{避免的人物形象或姿势}

### 场景/背景偏好
- 首选场景：{家居/咖啡馆/户外/工作室/纯色背景}
- 道具风格：{极简 / 丰富生活细节 / 品牌专属道具}
- 季节/时段：{清晨光线 / 黄金时段 / 白天自然光 / 城市夜景}
```

### 负向关键词库（Negative Prompts）

对 AI 生成质量影响极大，必须明确：

```markdown
## 全局 Negative Prompts

### 通用排除（所有素材）
ugly, deformed, blurry, low quality, watermark, text overlay, logo,
distorted hands, extra fingers, missing limbs, bad anatomy,
oversaturated, unnatural colors, plastic skin, AI-looking artifacts

### 品牌专属排除
{根据品牌调性添加：如 "dark moody lighting" 如果品牌是轻盈系 /
"busy cluttered background" 如果品牌是极简系}
```

### 结构化输出格式：style.json（配套 markdown 表格，不是替代）

上面的 markdown 表格是给人读的；`style.json` 是给下一次生成、给另一个工具、给版本对比用的机器可读格式——同一份品牌视觉语言，两种输出都写，不用二选一。字段设计：

```json
{
  "style_id": "{品牌slug}-{风格代号，如 clean-minimal-v1}",
  "version": "v1.0",
  "prompt_template": "{SUBJECT}, {SCENE}, {LIGHTING}, {COMPOSITION}, {STYLE_KEYWORDS}, {TECH_PARAMS}",
  "environment_variables": {
    "SUBJECT": "{对应 模块1·人物风格：人种/年龄段/气质/妆容}",
    "SCENE": "{对应 模块1·场景偏好：首选场景/道具风格/季节时段}",
    "LIGHTING": "{对应 模块1·色彩系统：光影偏好}",
    "COMPOSITION": "{对应 模块1·构图偏好：画面关系/景深/视角/留白方向}",
    "STYLE_KEYWORDS": "{对应 模块1·风格底色：整体美学方向/时代感/情绪温度}",
    "TECH_PARAMS": "{工具专属参数，如 Midjourney 的 --ar --style --v}"
  },
  "style_fidelity_anchors": [
    "{跨素材/跨批次必须保持不变的锚点，如色彩系统的主色 hex、人物气质关键词——用于校验第 N 张图是否'跑偏'}"
  ],
  "negative_prompt": "{对应上方 全局 Negative Prompts 的 通用排除 + 品牌专属排除，拼成一个字符串}",
  "source_content_to_avoid": [
    "{品牌专属排除里每一条拆成独立条目，便于工具按条校验而非整段字符串匹配}"
  ],
  "examples": [
    {
      "case_name": "{如 小红书封面图-护肤品牌}",
      "values": { "SUBJECT": "...", "SCENE": "...", "LIGHTING": "...", "COMPOSITION": "...", "STYLE_KEYWORDS": "...", "TECH_PARAMS": "..." }
    }
  ]
}
```

写入 `campaigns/{project-slug}/style/{style_id}.json`（若同一 campaign 需要多套风格 — 如主品牌风格 + 大促风格 — 每套一个文件，`version` 递增记录迭代历史，不覆盖旧版本）。`style_fidelity_anchors` 是最该被使用的字段：素材矩阵批量生成后，抽查新素材是否仍命中锚点，是校验"品牌视觉是否跑偏"最快的办法，比人工过一遍所有图快得多。

---

## 模块 2：AI 图片生成 Prompt 体系

### Prompt 结构公式

**Midjourney / Flux 通用结构：**

```
[主体描述] + [场景/背景] + [光线] + [构图] + [风格关键词] + [技术参数]
```

**示例 — 护肤品牌产品图：**

```
glass skincare serum bottle on marble surface, morning sunlight from left window,
soft bokeh background with green plants, minimalist lifestyle aesthetic,
warm ivory tones, editorial photography style, high-end cosmetics commercial,
shallow depth of field, clean white negative space on right side for text
--ar 4:5 --style raw --v 6
```

### 按商业用途的 Prompt 模板

**1. 产品主图（商品详情/电商）**

```markdown
## 产品主图 Prompt

### 目标：清晰展示产品，建立品质感
结构：产品 + 极简背景 + 恰当光影 + 品质感关键词

基础模板：
"{产品名称} isolated on {背景色/材质} background,
{光线描述：studio lighting / soft window light / gradient light},
product photography, commercial advertising,
{品牌色调关键词}, high resolution, sharp focus
--ar {平台比例} --style raw"

变体：
- 白底图：plain white background, professional product shot
- 场景图：in-use scene, lifestyle context, {使用场景}
- 成分图：key ingredient visual, {成分描述}, natural texture
```

**2. 人物种草图（小红书/Instagram）**

```markdown
## 人物种草图 Prompt

目标：真实可信、有生活感、用户代入感强

基础模板：
"{年龄段} {人群描述} woman/man, {场景：morning skincare routine /
cafe lifestyle / natural outdoor setting},
{产品使用动作：applying serum / holding product},
candid lifestyle photography, natural light, soft aesthetic,
{品牌调性关键词}, authentic everyday moment
--ar 4:5 --style raw"

注意事项：
- 避免：过度修图感、假笑、刻意摆拍
- 加入：自然表情、真实环境细节、生活感道具
```

**3. 广告 Banner（付费投放）**

```markdown
## 广告 Banner Prompt

目标：高点击率，前 3 秒抓住注意力

基础模板：
"{视觉冲击主体}, {强对比/高饱和 or 品牌调性},
eye-catching composition, {情绪关键词：energetic/calming/luxurious},
advertising visual, clean text placement area on {方位},
{颜色系统}, professional commercial photography
--ar {16:9 横版 / 9:16 竖版 / 1:1 方版}"

高点击率视觉策略：
- before/after 对比结构
- 强视觉对比（产品vs背景）
- 人物表情情绪带入
- 数字/结果视觉化
```

**4. 品牌形象大图**

```markdown
## 品牌形象图 Prompt

目标：建立品牌调性，提升品牌溢价感

基础模板：
"{品牌世界观描述：luxurious morning ritual / sustainable coastal lifestyle},
{场景细节堆砌}, cinematic lighting, {摄影风格：Annie Leibovitz style /
editorial Vogue aesthetic / documentary realism},
{品牌色调}, wide angle establishing shot, aspirational lifestyle
--ar 16:9 --style raw --stylize 750"
```

---

## 模块 3：AI 视频生成 Prompt 体系

### 主流工具特点与适用场景

| 工具 | 强项 | 适用场景 | Prompt 逻辑 |
|------|------|---------|------------|
| Kling（可灵） | 中文理解强，人物动作自然 | 国内投放素材，人物类 | 中文描述+动作指令 |
| Runway Gen-3 | 电影质感，光影优秀 | 品牌形象视频，高端感 | 英文，强调摄影术语 |
| Sora | 长视频，物理真实感 | 场景类，无人物 | 英文，电影语言 |
| Pika | 图生视频，局部动效 | 静态产品图加动效 | 图片+简短动作描述 |
| Stable Video | 可控性强，适合循环动效 | Banner 动效，短循环 | 参数控制为主 |

### 视频 Prompt 结构

```
[场景建立] + [主体描述和动作] + [摄影机运动] + [光线/氛围] + [节奏/风格]
```

**摄影机运动关键词库：**

| 运动方式 | 英文关键词 | 效果 |
|---------|---------|------|
| 缓慢推进 | slow dolly in / slow zoom in | 紧张感、强调细节 |
| 缓慢后拉 | slow dolly out / pull back | 宏大感、揭示场景 |
| 环绕产品 | orbit shot / 360 product reveal | 产品展示 |
| 上升俯视 | crane up / aerial pull back | 场景建立、宏观 |
| 手持跟拍 | handheld follow / documentary style | 真实感、日常感 |
| 固定静帧 | static shot / locked off camera | 稳重、专注主体 |

### 按内容类型的视频 Prompt 模板

**1. 产品展示视频（5-15秒）**

```markdown
## 产品展示视频 Prompt

Kling 版本（中文）：
"{产品名}放置在{场景}上，柔和的{方向}光照射，
镜头缓慢环绕产品一圈，展示产品质感和细节，
{品牌调性：高端极简/温暖自然}，
商业广告质感，超清画质"

Runway 版本（英文）：
"Luxury {product} on {surface}, cinematic slow orbit shot,
{lighting: golden hour sunlight / soft studio diffused light},
{brand texture: glass reflection / matte finish / metallic sheen},
high-end cosmetics advertisement, 4K ultra detailed,
slow motion 24fps cinematic"
```

**2. 生活方式种草视频（15-30秒）**

```markdown
## 生活方式视频 Prompt

Kling 版本：
"{人物描述}在{场景}中，{具体动作：涂抹产品/享受早晨仪式感}，
自然光从窗户射入，温暖氛围，真实生活记录感，
不是广告感，像朋友分享日常，
镜头跟随人物，轻微手持感"

节奏参考：
- 0-3s：场景/氛围建立（抓注意力）
- 3-10s：产品使用过程（建立关联）
- 10-20s：效果/感受呈现（情感共鸣）
- 20-30s：品牌/产品特写（记忆锚点）
```

**3. Before/After 效果视频**

```markdown
## Before/After Prompt

策略：最高转化率的视频类型之一，需要清晰的视觉对比

结构：
Part 1 (Before)：{问题状态描述}，对比度稍低，色调偏冷/哑
Part 2 (After)：{改善状态描述}，饱和度提升，色调暖且亮

Prompt 要点：
- Before：slightly dull skin, uneven tone, morning without skincare
- After：glowing radiant skin, smooth texture, healthy luminosity
- 过渡：smooth morphing transition / split screen comparison
- 避免：过度夸张，失真，不真实的效果
```

---

## 模块 4：平台素材规格矩阵

不同平台对素材尺寸、时长、风格有不同要求。

```markdown
## 平台素材规格

### 图片素材
| 平台 | 用途 | 尺寸比例 | 推荐分辨率 | 风格要求 |
|------|------|---------|----------|---------|
| 小红书 | 封面图 | 3:4 | 1080×1440 | 有氛围感，文字叠加空间 |
| 小红书 | 详情图 | 1:1 | 1080×1080 | 信息密度高 |
| 抖音/TikTok | 封面 | 9:16 | 1080×1920 | 人物视觉冲击，前3秒抓眼 |
| Instagram | Feed | 1:1 / 4:5 | 1080×1080 | 品牌调性一致性 |
| Instagram | Stories | 9:16 | 1080×1920 | 沉浸式，互动元素 |
| Amazon | 主图 | 1:1 | 2000×2000 | 白底，产品占图85% |
| Amazon | 生活图 | 1:1 | 2000×2000 | 场景化，使用状态 |
| 独立站 | Banner | 16:9 | 1920×1080 | 品牌形象，文字区域 |

### 视频素材
| 平台 | 时长 | 比例 | 关键要求 |
|------|------|------|---------|
| 小红书 | 15-60s | 9:16 | 前3秒留住用户，字幕必须 |
| 抖音 | 15-60s | 9:16 | 节奏快，音乐感强 |
| TikTok | 15-60s | 9:16 | 原生感，非广告感 |
| Instagram Reels | 15-30s | 9:16 | 高质感，音乐驱动 |
| YouTube Shorts | <60s | 9:16 | 信息密度高 |
| 开屏广告 | 3-5s | 9:16 / 16:9 | 品牌识别，强记忆点 |
| Feed广告 | 6-15s | 1:1 / 4:5 | 前1秒必须抓住眼球 |
```

---

## 模块 5：素材矩阵规划

从散点式生产到系统化的素材工厂。

### 素材矩阵框架

```markdown
## 素材矩阵规划

### Campaign 素材需求总览
| 素材类型 | 数量 | 平台 | 用途 | 生成工具 | 优先级 |
|---------|------|------|------|---------|--------|
| 产品白底图 | 5-10张 | Amazon/独立站 | 主图 | Midjourney/Flux | P0 |
| 产品场景图 | 10-20张 | 小红书/INS | 种草内容 | Midjourney | P0 |
| 人物使用图 | 5-10张 | 小红书/TikTok | KOC内容参考 | Kling/Midjourney | P1 |
| 品牌形象图 | 3-5张 | 独立站/广告 | 品牌建设 | Midjourney/Runway | P1 |
| 产品展示视频 | 3-5条 | 全平台 | 广告投放 | Kling/Runway | P0 |
| 生活方式视频 | 5-10条 | 小红书/抖音 | 内容种草 | Kling | P1 |
| 动效Banner | 3条 | 信息流广告 | 付费投放 | Pika/Runway | P1 |

### A/B 测试素材计划
每个核心广告位建议准备：
- 3种不同"第一帧"（测试抓眼能力）
- 2种色调方向（测试品牌色vs高对比色）
- 2种人物vs无人物版本（测试用户代入感）
```

---

## 模块 6：品牌一致性质检标准

AIGC 批量生产最大的问题是风格飘移。这是质检框架。

```markdown
## AIGC 素材质检清单

### 必须通过的品牌一致性检查
- [ ] 色调是否在品牌色系范围内？
- [ ] 画面氛围是否符合品牌情绪定义？
- [ ] 人物（如有）是否符合品牌目标人群形象？
- [ ] 场景道具是否与品牌生活方式匹配？
- [ ] 没有出现品牌明确禁止的视觉元素？

### 商业可用性检查
- [ ] 分辨率是否满足平台要求？
- [ ] 有无 AI 明显缺陷（畸形手指/文字错误/形体变形）？
- [ ] 人物面部是否自然（无过度磨皮/塑料感）？
- [ ] 产品细节是否清晰可辨？
- [ ] 是否有文字叠加空间（Banner/封面图需要）？

### 合规检查
- [ ] 无侵权元素（知名人物/竞品/版权图案）
- [ ] 无违禁内容
- [ ] 效果类素材未过度夸张失实
```

---

## 模块 7：进阶技巧

### IP 一致性（同一人物跨素材）

```markdown
## 虚拟形象一致性方案

### Midjourney 方案（--sref + --cref）
1. 生成第一张满意的人物/场景图，保存 seed 值
2. 后续生成使用：--sref {首张图URL} --sref-w 100
3. 人物参考：--cref {人物图URL}
4. 保持风格权重：--stylize 值保持一致

### 品牌 LoRA 方案（Stable Diffusion）
- 用 5-20 张品牌视觉素材训练专属 LoRA
- 每次生成调用 LoRA，保证风格高度一致
- 适合有大量素材生产需求的品牌

### Flux Redux（图生图一致性）
- 将品牌调性参考图传入 Redux
- 生成图与参考图在风格/色调上高度匹配
```

### Prompt 迭代方法

```
第一步：用简单 Prompt 建立基础构图
第二步：加入品牌视觉关键词
第三步：加入技术参数（ar/style/v）
第四步：加入 Negative Prompt
第五步：保存 seed，在此基础上微调
第六步：批量变体（Vary Region/Subtle）
```

---

## 输出模式

### 快速 Prompt 生成

用户说"帮我写一个 Midjourney Prompt 生成 XX"时，直接输出可用的 Prompt，附简要说明。

### 完整 AIGC 方案

用户要"系统规划 AIGC 素材生产"时，输出全部 7 个模块。

### 素材矩阵规划

用户说"我要做一个 campaign 的所有素材"时，重点输出模块 5，给出完整的素材清单和 Prompt 包。

---

## 与其他技能的联动

| 联动技能 | 联动方式 |
|---------|---------|
| mc-insight | 文化调性和情绪方向 → 定义 AIGC 的视觉情绪 |
| mc-product | 产品调性/包装方向 → 建立 Prompt 基础视觉语言 |
| mc-content | 内容策略 → 确定各平台素材需求类型和数量 |
| mc-campaign | Campaign 节奏 → 素材矩阵按上市阶段分配 |
| mc-dtc | 独立站视觉规范 → AIGC 保持站点视觉一致 |

---

## 交互规则

- AIGC 技能可独立使用（"帮我写个生图 Prompt"）
- 也可作为内容/campaign 规划后的执行层
- 用户提供品牌参考图/竞品图时，系统分析并提炼视觉语言关键词
- 输出的 Prompt 可直接粘贴进对应工具使用
- 素材质检标准可直接发给设计/运营团队
- 输出完成后告诉用户文件路径，不要在对话中重复全文

---

## 交付规范

执行完成后**必须**以下方格式收尾，完整报告内容不得出现在对话中：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ mc-aigc · AIGC 方案完成
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 文件：campaigns/{slug}/aigc.md

📌 执行摘要
   · 素材类型：{图片 N 组 / 视频 N 条 / 混合}
   · 主要工具：{Midjourney / Kling / Runway / 组合}
   · 品牌视觉核心词：{3-5 个最关键的调性关键词}
   · 素材矩阵：{N 个平台，共 N 套素材}

➡️  下一步：{将 Prompt 导入对应工具生成 / 完成后进行品牌一致性质检}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

如需展开查看任意模块，用户说"展开 XX 部分"即可。
