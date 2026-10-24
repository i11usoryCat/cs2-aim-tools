# CS2 Aim Tools

> 浏览器端的瞄准灵敏度标定与甩枪训练工具。无需安装、无需进入游戏、不读取任何游戏数据。

[![GitHub Pages](https://img.shields.io/badge/在线使用-GitHub%20Pages-2ea043?style=flat-square)](https://i11usorycat.github.io/cs2-aim-tools/)
[![License](https://img.shields.io/badge/license-MIT-58a6ff?style=flat-square)](LICENSE)

---

## 在线使用

| 页面 | 地址 | 说明 |
| --- | --- | --- |
| **首页** | https://i11usorycat.github.io/cs2-aim-tools/ | 入口动画 + 软件清单 |
| **训练中心** | https://i11usorycat.github.io/cs2-aim-tools/app.html | 数据 / 计划 / 训练 / 设置 |
| **训练计划** | https://i11usorycat.github.io/cs2-aim-tools/program.html | 四周计划与进度 |

单项工具：

| 工具 | 地址 |
| --- | --- |
| 灵敏度标定（推荐） | https://i11usorycat.github.io/cs2-aim-tools/tools/sensitivity-calibrator.html |
| 灵敏度标定（严格口径） | https://i11usorycat.github.io/cs2-aim-tools/tools/sensitivity-calibrator-strict.html |
| 甩枪训练 · 自适应随机 | https://i11usorycat.github.io/cs2-aim-tools/tools/aim-trainer.html?mode=random&count=40&limit=1 |
| 甩枪训练 · 定角重复 | https://i11usorycat.github.io/cs2-aim-tools/tools/aim-trainer.html?mode=block&count=40&limit=0 |
| 甩枪训练 · 小球精度 | https://i11usorycat.github.io/cs2-aim-tools/tools/aim-trainer.html?mode=precision&count=40&limit=0 |

---

## 功能

### 灵敏度标定（过冲法）

记录每次甩动的落点相对目标的偏移，直接反推该填的 sensitivity：

```text
f        = (落点投影距离 - 目标距离) / 目标距离     带符号的过冲率
cm/360'  = cm/360 × (1 + 中位数 f)
```

- 全部样本累计池化，避免单轮噪声
- 连续两轮变化 < 1% 时提示「已收敛」
- 命中（角度误差 ≤ 球半径）不计入偏差统计

### 甩枪训练

三种模式，对应运动学习的不同阶段：

| 模式 | 机制 | 用途 |
| --- | --- | --- |
| 自适应随机 | 球大小与限时按 **85% 成功率**自动调节 | 主练 |
| 定角重复 | 同一角度连打 8 球 | 形成运动程序，热身 |
| 小球精度 | 固定 0.7° 球，无时限 | 练一次定位精度 |

### 四周训练计划

每天 15 分钟，5 天训练 2 天休息。自动判断第几天、第几周，列出今日任务并记录进度。

### 数据记录

所有数据存放在浏览器 `localStorage`，不上传任何服务器：

| 键 | 内容 |
| --- | --- |
| `cs2at.cfg` | DPI / m_yaw / sensitivity / cm/360 |
| `cs2at.best` | 各模式最佳成绩 |
| `cs2at.runs` | 历史记录（最多 300 条） |
| `cs2at.log` | 计划页的训练日志 |
| `cs2at.perf` | 性能模式开关 |

> 注意：`file://` 与 `https://` 是**两套独立存储**，桌面文件与在线版的数据不互通。切换方式后记录不可见。可在「个人数据」页导出 JSON 备份。

---

## 快速开始

1. 打开训练中心的 **设置** 页，填入 DPI、m_yaw、当前灵敏度
2. 进入 **训练** 页，先跑一次「灵敏度标定」，拿到建议值
3. 回到设置页更新 sensitivity
4. 进入 **计划训练** 页，按今日任务练
5. 每练完一组，在训练页点「复制本组数据」，粘到计划页保存

---

## 数学原理

Source 引擎里视角变化为：

```text
Δangle = mouse_counts × sensitivity × m_yaw
```

所以：

```text
degrees_per_count = sensitivity × m_yaw
counts_per_360     = 360 / (sensitivity × m_yaw)
cm_per_360         = counts_per_360 / DPI × 2.54
```

反解 sensitivity：

```js
sensitivity = 360 / (cm_per_360 / 2.54 * DPI) / m_yaw;
```

训练难度控制参考费茨定律：

```text
MT = a + b · log2(2D / W)
```

降低 W（球半径）或提高 D（距离）都会增加难度。难度由单一控制器调节，避免多个反馈回路互相冲突。

---

## 项目结构

```text
cs2-aim-tools/
├── index.html                            首页（入口动画 + 软件清单）
├── app.html                              训练中心（数据/计划/训练/设置）
├── program.html                          四周训练计划
├── tools/
│   ├── sensitivity-calibrator.html         灵敏度标定（全样本）
│   ├── sensitivity-calibrator-strict.html  灵敏度标定（仅未命中）
│   └── aim-trainer.html                    甩枪训练（三种模式）
├── windows/
│   └── RawLogger.cs                      Windows 原始输入记录器
├── docs/
│   ├── methodology.md                   方法论与踩坑记录
│   └── training-plan.md                 四周训练方案
└── LICENSE
```

---

## 浏览器要求

- 推荐 **Chrome / Edge**（支持 `pointerrawupdate`，可用原始输入频率采样）
- Firefox 可运行，但采样精度下降，页面会显示提示
- 需要 HTTPS 或 `localhost`，否则指针锁定（Pointer Lock）不可用

---

## Windows 原始输入记录器

`windows/RawLogger.cs` 用 `GetRawInputBuffer` 读取 HID 原始报告，用于验证鼠标真实回报率与报告间隔抖动。

```powershell
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /nologo /target:winexe /unsafe /out:RawLogger.exe `
  /reference:System.Windows.Forms.dll /reference:System.Drawing.dll RawLogger.cs
```

> 关键教训：同步写磁盘会阻塞消息循环，Windows 随即合并 `WM_INPUT`，实测从 4207 Hz 掉到 124 Hz。生产用途请先在内存中缓冲。

---

## 一个真实的标定案例

环境：9800X3D + RX 9070 XT + 400Hz 显示器 + NP-01S V3 @ 1000 DPI。

| cm/360 | 过冲比例 | 累计样本 |
| ---: | ---: | ---: |
| 23.2 | +7.4% | 34 |
| 24.9 | +4.8% | 66 |
| 26.1 | +2.9% | 100 |
| 26.9 | +2.9% | 130 |
| 27.7 | +2.3% | 160 |

连续两轮变化 0.7%，判定收敛。最终 `sensitivity 2.04 / m_yaw 0.0165 / 27.2 cm/360`，过冲从 +7.4% 降至 -0.1%。

---

## 文档

- [方法论与踩坑记录](docs/methodology.md)
- [四周训练方案](docs/training-plan.md)

---

## 许可

[MIT](LICENSE)
