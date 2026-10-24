# CS2 Aim Tools

> 浏览器端的**瞄准灵敏度标定**与**甩枪训练**工具。无需安装、无需进入游戏、不读取任何游戏数据。

### 🎮 在线直接使用（不用下载）

| 工具 | 链接 |
|---|---|
| **灵敏度标定 · 过冲法**（推荐） | https://i11usorycat.github.io/cs2-aim-tools/tools/sensitivity-calibrator.html |
| 灵敏度标定 · 严格口径 | https://i11usorycat.github.io/cs2-aim-tools/tools/sensitivity-calibrator-strict.html |
| **甩枪训练 · 自适应难度** | https://i11usorycat.github.io/cs2-aim-tools/tools/aim-trainer.html |

首页：https://i11usorycat.github.io/cs2-aim-tools/

---

## 包含什么

| 文件 | 用途 |
|---|---|
| `tools/sensitivity-calibrator.html` | **过冲法灵敏度标定**（推荐）——测出你甩枪「过头」或「不足」多少，直接算出该填的 sensitivity |
| `tools/sensitivity-calibrator-strict.html` | 同上，但只统计未命中的球（更严格的口径） |
| `tools/aim-trainer.html` | **自适应难度训练**——球的大小与限时按 85% 成功率自动调节 |
| `windows/RawLogger.cs` | Windows 原生 HID 原始输入记录器（8KB，需要 .NET Framework 编译） |

三个网页工具都是**单文件 HTML**，双击即可运行，不需要服务器。

## 快速开始

### 1. 标定灵敏度

```
1. 用 Chrome 或 Edge 打开 tools/sensitivity-calibrator.html
2. 填入：鼠标 DPI、m_yaw、当前 cm/360
3. 点开始 → 鼠标被锁定，红球出现在任意方向
4. 最快速度甩过去，手一停就点左键
5. 20-40 个球后出结果：应改为 sensitivity = X
6. 点「再测一轮」会自动带入建议值，直到出现「✓ 已收敛」
```

### 2. 训练

```
1. 打开 tools/aim-trainer.html
2. 填 DPI 和 cm/360
3. 每组 40 球，每天 5 组，每周 5 天
4. 目标：命中率保持 80%，限时逐周下降 10-15ms
```

## 数学原理

### 灵敏度定义

Source 引擎里视角变化为：

```
Δangle = mouse_counts × sensitivity × m_yaw
```

所以：

```
degrees_per_count = sensitivity × m_yaw
counts_per_360     = 360 / (sensitivity × m_yaw)
cm_per_360         = counts_per_360 / DPI × 2.54
```

反解 sensitivity：

```
sensitivity = 360 / (cm_per_360 / 2.54 × DPI) / m_yaw
```

### 过冲法标定

记录每次甩动的落点相对目标的偏移：

```
f = (落点投影距离 - 目标距离) / 目标距离      // 带符号的过冲率
cm_new = cm_current × (1 + f_median)
```

`f > 0` 说明总是甩过头（灵敏度过高），`f < 0` 说明总是不足。

### 训练难度控制

- **85% 原则**：训练难度维持在成功率 70–85% 时学习效率最高
- **费茨定律**：`MT = a + b·log2(2D/W)`，降低 W（球半径）或提高 D（距离）都会增加难度
- **单控制器**：同一时刻只调一个变量（限时模式下调时间、否则调球半径），避免两个反馈回路互相冲突

## 注意事项

- 浏览器 `movementX/Y` 在 Windows 指针速度 6/11（默认）下等效于鼠标 counts；改过指针速度会让换算偏高或偏低
- 指针锁定（Pointer Lock）必须由用户手势触发；按 Esc 会释放，程序会自动暂停
- 建议全屏运行，并使用 `unadjustedMovement` 绕过系统指针加速（已内置）
- 需要 Chrome / Edge 等支持 `pointerrawupdate` 的浏览器

## 一个真实的标定案例

作者（9800X3D + RX 9070 XT + 400Hz 显示器 + NP-01S V3 @ 1000 DPI）的标定过程：

```
cm/360    过冲比例    累计样本
23.2      +7.4%        34
24.9      +4.8%        66
26.1      +2.9%       100
26.9      +2.9%       130
27.7      +2.3%       160     ← 连续两轮变化 <1%，收敛
```

最终：`sensitivity 2.04 / m_yaw 0.0165 / 27.2 cm/360`，过冲从 +7.4% 降到 -0.1%。

## Windows 原始输入记录器

`windows/RawLogger.cs` 是一个 ~200 行的 C# 程序，用 `GetRawInputBuffer` 读取 HID 原始报告，用于验证鼠标实际回报率与报告间隔抖动：

```powershell
$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csc /target:winexe /unsafe /out:RawLogger.exe `
  /reference:System.Windows.Forms.dll /r:System.Drawing.dll RawLogger.cs
```

> 注意：同步写磁盘会阻塞消息循环导致报告被合并，实测会从 4000Hz 掉到 125Hz。生产用途请先在内存缓冲。

## License

MIT
