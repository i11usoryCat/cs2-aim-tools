using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Text;
using System.Windows.Forms;

public class RawLogger : Form
{
    [StructLayout(LayoutKind.Sequential)] struct RAWINPUTDEVICE { public ushort usUsagePage; public ushort usUsage; public uint dwFlags; public IntPtr hwndTarget; }
    [StructLayout(LayoutKind.Sequential)] struct RAWINPUTHEADER { public uint dwType; public uint dwSize; public IntPtr hDevice; public IntPtr wParam; }
    [StructLayout(LayoutKind.Sequential)] struct RAWMOUSE { public ushort usFlags; public ushort usButtonFlags; public ushort usButtonData; public uint ulRawButtons; public int lLastX; public int lLastY; public uint ulExtraInformation; }

    [DllImport("user32.dll", SetLastError = true)] static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] d, uint n, uint cb);
    [DllImport("user32.dll")] static extern uint GetRawInputData(IntPtr h, uint cmd, IntPtr p, ref uint size, uint hsize);
    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr h, int id, uint mod, uint vk);

    const uint RID_INPUT = 0x10000003;
    const ushort PAGE_GENERIC = 1, USAGE_MOUSE = 2;
    const int WM_INPUT = 0xFF, WM_HOTKEY = 0x312;
    const uint VK_F9 = 0x78;

    static StreamWriter log;
    static Stopwatch sw;
    static long cnt = 0, marks = 0, dxSum = 0;
    static NotifyIcon tray;
    DateTime deadline;

    public RawLogger(string path, int minutes)
    {
        Text = "RawLogger";
        ShowInTaskbar = false;
        WindowState = FormWindowState.Minimized;
        Opacity = 0;
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.Manual;
        Location = new System.Drawing.Point(-4000, -4000);
        Size = new System.Drawing.Size(10, 10);

        log = new StreamWriter(path, false, new UTF8Encoding(false));
        log.AutoFlush = true;
        log.WriteLine("event,qpc_ms,dx,dy");
        log.WriteLine("# armed");
        sw = Stopwatch.StartNew();

        tray = new NotifyIcon();
        tray.Icon = System.Drawing.SystemIcons.Application;
        tray.Text = "鼠标原始数据记录";
        tray.Visible = true;
        var menu = new ContextMenuStrip();
        menu.Items.Add("打标记 (F9)", null, (s, e) => AddMark());
        menu.Items.Add("退出", null, (s, e) => Close());
        tray.ContextMenuStrip = menu;

        var t = new System.Windows.Forms.Timer();
        t.Interval = 1000;
        t.Tick += (s, e) => { tray.Text = "记录中 | 事件 " + cnt + " | 标记 " + marks + " | F9=标记"; };
        t.Start();

        deadline = DateTime.Now.AddMinutes(minutes);
        var quit = new System.Windows.Forms.Timer();
        quit.Interval = 5000;
        quit.Tick += (s, e) => { if (DateTime.Now > deadline) Close(); };
        quit.Start();
    }

    void AddMark()
    {
        marks++;
        log.WriteLine("# MARK " + sw.Elapsed.TotalMilliseconds.ToString("F3") + " reports=" + cnt + " dx=" + dxSum);
        log.Flush();
        try { tray.ShowBalloonTip(1500, "已标记 #" + marks, "事件 " + cnt + " 条", ToolTipIcon.Info); } catch { }
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        var rid = new RAWINPUTDEVICE[1];
        rid[0].usUsagePage = PAGE_GENERIC;
        rid[0].usUsage = USAGE_MOUSE;
        rid[0].dwFlags = 0x100;
        rid[0].hwndTarget = Handle;
        RegisterRawInputDevices(rid, 1, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE)));
        RegisterHotKey(Handle, 1, 0, VK_F9);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_INPUT)
        {
            uint size = 0;
            GetRawInputData(m.LParam, RID_INPUT, IntPtr.Zero, ref size, (uint)Marshal.SizeOf(typeof(RAWINPUTHEADER)));
            if (size > 0)
            {
                IntPtr buf = Marshal.AllocHGlobal((int)size);
                try
                {
                    if (GetRawInputData(m.LParam, RID_INPUT, buf, ref size, (uint)Marshal.SizeOf(typeof(RAWINPUTHEADER))) == size)
                    {
                        RAWINPUTHEADER hdr = (RAWINPUTHEADER)Marshal.PtrToStructure(buf, typeof(RAWINPUTHEADER));
                        if (hdr.dwType == 0)
                        {
                            IntPtr pm = new IntPtr(buf.ToInt64() + Marshal.SizeOf(typeof(RAWINPUTHEADER)));
                            RAWMOUSE ms = (RAWMOUSE)Marshal.PtrToStructure(pm, typeof(RAWMOUSE));
                            if (ms.lLastX != 0 || ms.lLastY != 0)
                            {
                                cnt++; dxSum += ms.lLastX;
                                if (log != null) log.WriteLine("M," + sw.Elapsed.TotalMilliseconds.ToString("F4") + "," + ms.lLastX + "," + ms.lLastY);
                            }
                        }
                    }
                }
                finally { Marshal.FreeHGlobal(buf); }
            }
            DefWndProc(ref m);
            return;
        }
        if (m.Msg == WM_HOTKEY) { AddMark(); return; }
        base.WndProc(ref m);
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        try { log.WriteLine("# closed reports=" + cnt + " marks=" + marks); log.Close(); } catch { }
        try { tray.Visible = false; tray.Dispose(); } catch { }
        base.OnFormClosing(e);
    }

    [STAThread] public static void Main(string[] args)
    {
        bool created;
        using (var mtx = new System.Threading.Mutex(true, "DSH_RawLogger", out created))
        {
            if (!created) return;
            string path = args.Length > 0 ? args[0] : Path.Combine(Path.GetTempPath(), "rawmouse.csv");
            int minutes = args.Length > 1 ? int.Parse(args[1]) : 90;
            Application.Run(new RawLogger(path, minutes));
        }
    }
}
