# Vernier 全站 QA 回归报告（task-15）

- **任务**：QA 覆盖扩展与全站回归（task-15）
- **执行人**：verifier
- **时间**：2026-11-08 03:45 (Asia/Shanghai)
- **环境**：Windows + headless Edge `Edg/156.0.4314.58`，CDP；每个页面独立 `--user-data-dir`（脚本内置，互不影响）
- **被测快照**（报告生成时）：

| 文件 | size | mtime (UTC) | md5 前 12 位 |
|---|---|---|---|
| `tools/aim-trainer.html` | 158839 | 2026-11-07T19:17:23.257Z | `f1094e9773ac` |
| `app.html` | 162224 | 2026-11-07T19:35:11.413Z | `f317051bd113` |
| `index.html` | 38251 | 2026-11-07T19:27:07.733Z | `a1cb8821a860` |
| `methodology.html` | 18407 | 2026-11-07T19:22:17.548Z | `18310b24e6cd` |
| `program.html` | 21156 | 2026-11-06T21:09:19.018Z | `19f5bd2d4431` |
| `tools/tracking-calibrator.html` | 47567 | 2026-11-07T19:24:52.126Z | `2095ccd9f722` |
| `tools/openloop-calibrator.html` | 38575 | 2026-11-07T18:34:32.122Z | `5b373dfea4a2` |
| `tools/sensitivity-calibrator-strict.html` | 44962 | 2026-11-07T18:34:32.148Z | `b33e62791add` |
| `en/index.html` | 29871 | 2026-11-07T19:37:23.423Z | `12d604a94cd4` |
| `en/six-dim.html` | 87553 | 2026-11-07T19:33:57.097Z | `c994ea138a22` |
| `en/methodology.html` | 19411 | 2026-11-07T19:24:51.444Z | `7cf037e512c8` |
| `en/plan.html` | 806 | 2026-11-06T21:19:59.424Z | `4737ea1611ec` |

> 运行前后快照哈希一致（最后一轮 qa.cjs 期间无文件变更）；`en/` 页面的重建在本轮开始前已完成。

## 0. 结论速览

| # | 脚本 | 退出码 | 耗时 | 覆盖 | 结果 |
|---|---|---|---|---|---|
| 1 | `scripts/qa.cjs` | 0 | 68.1s | 21 个页面 + axis 模式 + 9 个训练模式结果页 + en/ 一致性 | ✅ 0 问题 |
| 2 | `scripts/qa-monkey.cjs` | 0 | 73.7s | 7 个页面按钮 + 3 个新结果页场景 + 渐隐 A0–A4 | ✅ 0 异常 |
| 3 | `scripts/qa-settings.cjs` | 0 | 75.0s | 设置项往返 32 个控件 | ✅ 0 未通过 |
| 4 | `scripts/qa-settings-semantics.cjs` | 0 | 23.1s | 设置语义 15 项 | ✅ 15/15 PASS |
| 5 | `scripts/qa-shots.cjs` | 0 | 26.7s | 全站截图 11 张（含 new axis） | ✅ 11/11 成功 |

**总计：五个脚本全部通过，最终问题清单 0 条。** 未修改任何页面/源码文件（仅扩展 3 个 QA 脚本 + 生成 QA 产物）。

## 1. qa.cjs — 全站检查（21 个页面，全部 0 问题）

常规检查维度：console 异常 / 重复 id / 水平溢出@1280 / 水平溢出@900 / 死链 / 中文页未翻译串。

| 检查维度 | 结果 |
|---|---|
| 页面数 | 21（含 `tools/aim-trainer.html?mode=axis`） |
| console 报错 | 0 |
| 重复 id | 0 |
| 水平溢出 @1280 / @900 | 0 / 0 |
| 死链 | 0 |
| 中文页 EN 未翻译串 | 0 |

页面清单：`404.html`、`app.html`、`crystal-preview.html`、`dialogue.html`、`en/index.html`、`en/methodology.html`、`en/six-dim.html`、`index.html`、`methodology.html`、`program.html`、`tools/aim-trainer.html`、`tools/openloop-calibrator.html`、`tools/sensitivity-calibrator-strict.html`、`tools/tracking-calibrator.html`、`八个字.html`、`关于练枪.html`、`回声.html`、`对话记录-公开节选.html`、`对话记录.html`、`小肥鱼.html`、`tools/aim-trainer.html?mode=axis`

## 2. 新增检查：9 个训练模式的结果页渲染（遍历 `?mode=`）

驱动方式：页面暴露的测试入口 `applyModeDefaults → beginSession → spawn/judge ×40 → finish`，检查结果页渲染、关键读数、异常与 NaN。

### 模式结果页明细

| 模式 | 结果页显示 | 内容长度 | 关键读数 | 异常 | 结论 |
|---|---|---|---|---|---|
| random | ✅ | 608 | 01 / 读数 · 自适应随机 · 40 球 · 限时 260 MS 0% 中位 | 0 | ✅ 通过 |
| block | ✅ | 576 | 01 / 读数 · 定角重复 · 40 球 0% 中位用时 0 ms · 40  | 0 | ✅ 通过 |
| precision | ✅ | 583 | 01 / 读数 · 小球精度 · 40 球 0% 中位用时 0 ms · 40  | 0 | ✅ 通过 |
| wide | ✅ | 582 | 01 / 读数 · 大角度甩枪 · 40 球 0% 中位用时 0 ms · 40 | 0 | ✅ 通过 |
| track | ✅ | 581 | 01 / 读数 · 移动跟枪 · 40 球 0% 中位用时 0 ms · 40  | 0 | ✅ 通过 |
| check | ✅ | 2583 | 01 / 读数 · 90 秒六维检查 · 40 球 28/100 40 球 ·  | 0 | ✅ 通过 |
| staircase | ✅ | 336 | 01 / 读数 · 阶梯精度 · 40 球 6.00° 85% 命中率下的最小目 | 0 | ✅ 通过 |
| distance | ✅ | 681 | 01 / 读数 · 随机距离 · 距离 5–45° 随机 · 40 球 0% 中 | 0 | ✅ 通过 |
| axis | ✅ | 769 | T1=0ms · T2=0ms · A0 · n=40 | 0 | ✅ 通过 |

**结论：9/9 全部通过。** `axis` 结果页正确生成 `window.__axisReport = {t1,t2,dy,hit,level,n}`（T1/T2 中位数 + 当前渐隐等级 A0）；全部模式结果页无 `NaN/undefined/Infinity`、无页面异常。

## 3. 新增检查：en/ 与中文页一致性

### en/ 一致性明细

| en 页面 | 相对链接 | 死链 | 运行时中文残留 | 备注 |
|---|---|---|---|---|
| en/index.html | 10 | 0 | 0 |  |
| en/methodology.html | 2 | 0 | 0 |  |
| en/openloop-calibrator.html | 3 | 0 | - | 跳转 stub → ../tools/openloop-calibrator.html?lang=en（目标存在） · 目标支持 ?lang=en |
| en/plan.html | 3 | 0 | - | 跳转 stub → ../app.html?lang=en#plan（目标存在） · 目标支持 ?lang=en |
| en/sensitivity-calibrator.html | 3 | 0 | - | 跳转 stub → ../tools/sensitivity-calibrator-strict.html?lang=en（目标存在） · 目标支持 ?lang=en |
| en/six-dim.html | 10 | 0 | 0 |  |
| en/tracking-calibrator.html | 3 | 0 | - | 跳转 stub → ../tools/tracking-calibrator.html?lang=en（目标存在） · 目标支持 ?lang=en |

### 镜像差异：en/six-dim.html ↔ tools/aim-trainer.html

- 中文页最后修改：2026-11-07T19:17:23.257Z；英文镜像最后修改：2026-11-07T19:33:57.097Z
- en/six-dim.html 缺 mode 选项：无
- en/six-dim.html 缺新文案：无
- en/six-dim.html 源码中文字符数：3693（运行时按 navigator.language 判定语言）

**结论：全部通过。**
- 7 个 en 页面相对链接 0 死链；4 个跳转 stub（tracking / openloop / sensitivity / plan）目标均存在且目标页支持 `?lang=en`。
- 运行时英文页中文残留：en/index.html = 0、en/methodology.html = 0、en/six-dim.html = 0（`document.title` 也为英文）。
- `en/six-dim.html` 镜像与中文 `tools/aim-trainer.html` 已对齐：mode 选项无缺失（random/block/precision/wide/track/check/staircase/distance/axis），T1/T2/渐隐/分轴定位/阶梯精度/随机距离 等新文案无缺失。

## 4. qa-monkey — 交互猴 + 新结果页场景

### 4.1 各页面按钮点击（每个按钮独立重载后点击）

| 页面 | 按钮数 | 点击次数 | 异常 |
|---|---|---|---|
| `index.html` | 3 | 3 | 0 |
| `app.html` | 3 | 3 | 0 |
| `program.html` | 4 | 4 | 0 |
| `tools/aim-trainer.html` | 3 | 3 | 0 |
| `tools/tracking-calibrator.html` | 5 | 5 | 0 |
| `tools/openloop-calibrator.html` | 3 | 3 | 0 |
| `tools/sensitivity-calibrator-strict.html` | 3 | 3 | 0 |

> `tools/tracking-calibrator.html` 现有 5 个按钮，新增的「连续正弦 / 步进跟随（灵敏度探针）」按钮也被覆盖，0 异常。

### 4.2 新结果页场景（T1/T2 · 结果页按钮）

| 场景 | 结果页 | 内容长度 | 缺失文案 | 结果页按钮点击 |
|---|---|---|---|---|
| axis-result | ✅ 显示 | 769 | 无 | 再来一组:✅、复制本组数据:✅ |
| staircase-result | ✅ 显示 | 336 | 无 | 再来一组:✅、复制本组数据:✅ |
| distance-result | ✅ 显示 | 681 | 无 | 再来一组:✅、复制本组数据:✅ |

### 4.3 渐隐等级 A0–A4（`?axisLevel=k`）

| 等级 | 结果页 | 文案匹配 |
|---|---|---|
| A0 | ✅ | ✅ 「渐隐 A0」 |
| A1 | ✅ | ✅ 「渐隐 A1」 |
| A2 | ✅ | ✅ 「渐隐 A2」 |
| A3 | ✅ | ✅ 「渐隐 A3」 |
| A4 | ✅ | ✅ 「渐隐 A4」 |

> `#copy`（复制本组数据）在 headless 下剪贴板不可用，页面按设计以 `alert("复制失败，请手动复制：")` 降级，monkey 自动接受对话框；这是 headless 环境限制，不是页面异常。

## 5. qa-settings / qa-settings-semantics

- `qa-settings.cjs`：32 个设置控件往返（改值 → 重载 → 校验）全部恢复，**0 未通过**；隐藏控件（iPadMode/iResW/iResH/iCrossColor/iCrossEdge/iDotSize/iDotOutline/mixFlash/mixShatter/iHitCrossColor）按设计跳过。
- `qa-settings-semantics.cjs`：15 项语义检查全部 PASS（S1/S1b/S2/S3 换算、S4 持久化、S5 DPI 联动、S6/S6b clamp、S7 重置数据、S8 场景、S9 主题、S10 语言、S11 DPI=0、S12 cm 边界、S13 sens=0）。

## 6. qa-shots

11 张 1440×900 全站截图写入 `shots/pages/`，本次新增 `tools/aim-trainer-html-mode-axis.png`（新模式入镜）。清单：

- `shots/pages/app-html-play.png`
- `shots/pages/app-html-set.png`
- `shots/pages/index-html.png`
- `shots/pages/program-html.png`
- `shots/pages/tools-aim-trainer-html-mode-axis.png`
- `shots/pages/tools-aim-trainer-html-mode-distance.png`
- `shots/pages/tools-aim-trainer-html-mode-staircase.png`
- `shots/pages/tools-aim-trainer-html.png`
- `shots/pages/tools-openloop-calibrator-html.png`
- `shots/pages/tools-sensitivity-calibrator-strict-html.png`
- `shots/pages/tools-tracking-calibrator-html.png`

## 7. 本次对 QA 脚本的改动（writeScopes: scripts）

| 脚本 | 改动 |
|---|---|
| `scripts/qa.cjs` | ① 新增 `EXTRA_PAGES`，把 `tools/aim-trainer.html?mode=axis` 纳入常规全站检查；② 新增「9 个训练模式结果页渲染」检查（驱动 `applyModeDefaults/beginSession/spawn/judge/finish`，校验结果页显示、长度、关键文案、`__axisReport`、NaN）；③ 新增 en/ 一致性检查（静态链接扫描含 JS 跳转/meta-refresh、stub 目标存在性 + `?lang=en` 支持、en/six-dim 镜像 mode/文案差异、en 页面运行时中文残留与 title）；④ 修复原有窄屏溢出检查中 `send` 未定义的 bug（此前 overflow@900 恒为 0）；以上结果写入 `qa-report.md/json`。 |
| `scripts/qa-monkey.cjs` | ① 新增结果页场景：axis / staircase / distance 结果页渲染 + 结果页按钮逐一点击；② 新增渐隐等级 A0–A4 检查（`?axisLevel=k` 结果页文案匹配）；③ 支持 CDP 对话框自动接受（记录 alert）；④ 输出扩展至 `qa-monkey.md/json`（pages + scenarios + fadeLevels）。 |
| `scripts/qa-shots.cjs` | 截图页面增加 `tools/aim-trainer.html?mode=axis`。 |

## 8. 问题清单

- **最终状态：无问题（0 条）。**

过程发现（QA 期间已被并行修复，复测通过，不作为待修项）：
1. `en/index.html`：早期快照中版本点击彩蛋的 `location.href='对话记录.html' / '小肥鱼.html'` 未加 `../`（en/ 下死链）——重建后已改为正确路径，最终复测 0 死链。
2. `en/six-dim.html`：早期快照为旧镜像（缺 staircase/distance/axis、缺 T1/T2/渐隐 等新文案）——重建后与 `tools/aim-trainer.html` 对齐，最终复测无缺项。

非问题观察：
- headless 无剪贴板权限 → 结果页「复制本组数据」走 alert 降级（设计内），monkey 已自动关闭；
- 模式结果页检查用合成数据（40 球、无真实瞄准），读数命中率 0% / 用时 0ms 属预期，本项只验证「结果页能否正常渲染」。

## 9. 产物

| 文件 | 说明 |
|---|---|
| `qa-report.md` / `qa-report.json` | qa.cjs 全站 + 模式结果页 + en 一致性报告 |
| `qa-monkey.md` / `qa-monkey.json` | 交互猴 + 新结果页场景 + 渐隐等级 |
| `qa-settings.json` | 设置往返 32 控件 |
| `qa-settings-semantics.md` / `qa-settings-semantics.json` | 设置语义 15 项 |
| `shots/pages/*.png` | 11 张全站截图 |
| `qa-regression.md` | 本汇总报告 |
