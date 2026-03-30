Add-Type -AssemblyName System.Windows.Forms

$watcherFormSource = @"
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public static class NativeClipboardMethods
{
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool AddClipboardFormatListener(IntPtr hwnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool RemoveClipboardFormatListener(IntPtr hwnd);
}

public class ClipboardWatcherForm : Form
{
    private const int WM_CLIPBOARDUPDATE = 0x031D;
    public event EventHandler ClipboardChanged;

    protected override void SetVisibleCore(bool value)
    {
        base.SetVisibleCore(false);
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        NativeClipboardMethods.AddClipboardFormatListener(this.Handle);
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        NativeClipboardMethods.RemoveClipboardFormatListener(this.Handle);
        base.OnFormClosed(e);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_CLIPBOARDUPDATE)
        {
            EventHandler handler = ClipboardChanged;
            if (handler != null)
            {
                handler(this, EventArgs.Empty);
            }
        }

        base.WndProc(ref m);
    }
}
"@

Add-Type -TypeDefinition $watcherFormSource -ReferencedAssemblies System.Windows.Forms -Language CSharp

$form = New-Object ClipboardWatcherForm
$form.ShowInTaskbar = $false
$form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
$form.add_ClipboardChanged({
    [Console]::Out.WriteLine("CLIPBOARD_CHANGE")
    [Console]::Out.Flush()
})

[System.Windows.Forms.Application]::Run($form)
