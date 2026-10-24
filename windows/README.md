# RawLogger

Windows 端原始输入记录器，用于验证鼠标真实回报率与报告间隔抖动。

## 编译

```powershell
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /nologo /target:winexe /unsafe /out:RawLogger.exe `
  /reference:System.Windows.Forms.dll /reference:System.Drawing.dll RawLogger.cs
```

## 使用

```powershell
.\RawLogger.exe C:\temp\rawmouse.csv 90
```

| 参数 | 含义 |
| --- | --- |
| 第 1 个 | CSV 输出路径 |
| 第 2 个 | 运行分钟数（默认 90） |

运行时按 **F9** 打标记，日志里会写入 `# MARK`。

## 为什么不能在回调里写磁盘

```text
同步 WriteLine + AutoFlush  →  阻塞消息循环  →  Windows 合并 WM_INPUT
实测：同步写盘 124 Hz  /  内存缓冲 4207 Hz  （同一只 8K 鼠标）
```

生产用途请先在内存缓冲，结束后一次性写盘。
