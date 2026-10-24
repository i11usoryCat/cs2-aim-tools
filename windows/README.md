# RawLogger

Windows raw-input recorder for verifying real mouse polling rate and report-interval jitter.

## Build

```powershell
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /nologo /target:winexe /unsafe /out:RawLogger.exe `
  /reference:System.Windows.Forms.dll /reference:System.Drawing.dll RawLogger.cs
```

## Usage

```powershell
.\RawLogger.exe C:\temp\rawmouse.csv 90
```

| Argument | Meaning |
| --- | --- |
| 1 | Output CSV path |
| 2 | Run time in minutes (default 90) |

Press **F9** while it runs to write a `# MARK` line into the log.

## Why you must not write to disk in the callback

```text
synchronous WriteLine + AutoFlush  ->  blocks the message loop  ->  Windows coalesces WM_INPUT
measured: synchronous writes 124 Hz  /  in-memory buffering 4207 Hz (same 8K mouse)
```

Buffer in memory and flush once at the end for production use.
