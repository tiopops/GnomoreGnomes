"use strict";
// Cambio REAL de la resolución del monitor (como hacen los juegos en pantalla completa) para subir/bajar la carga gráfica.
// Electron no puede hacerlo, así que se usa un PowerShell auxiliar que llama a la API de Windows ChangeDisplaySettings con
// CDS_FULLSCREEN: es un cambio temporal que Windows deshace solo si la app se cierra o se cuelga. Si algo falla (no hay
// PowerShell, el monitor no admite esa resolución…) main.js sigue funcionando con el escalado de interfaz.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PS = String.raw`$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class GGD {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public struct DEVMODE {
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
    public short dmSpecVersion; public short dmDriverVersion; public short dmSize; public short dmDriverExtra;
    public int dmFields;
    public int dmPositionX; public int dmPositionY; public int dmDisplayOrientation; public int dmDisplayFixedOutput;
    public short dmColor; public short dmDuplex; public short dmYResolution; public short dmTTOption; public short dmCollate;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
    public short dmLogPixels;
    public int dmBitsPerPel; public int dmPelsWidth; public int dmPelsHeight; public int dmDisplayFlags; public int dmDisplayFrequency;
    public int dmICMMethod; public int dmICMIntent; public int dmMediaType; public int dmDitherType;
    public int dmReserved1; public int dmReserved2; public int dmPanningWidth; public int dmPanningHeight;
  }
  [DllImport("user32.dll", CharSet = CharSet.Ansi)] static extern bool EnumDisplaySettings(string dev, int n, ref DEVMODE m);
  [DllImport("user32.dll", CharSet = CharSet.Ansi, EntryPoint = "ChangeDisplaySettingsA")] static extern int CDS(ref DEVMODE m, int flags);
  [DllImport("user32.dll", CharSet = CharSet.Ansi, EntryPoint = "ChangeDisplaySettingsA")] static extern int CDS0(IntPtr m, int flags);
  static DEVMODE New() { DEVMODE m = new DEVMODE(); m.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE)); return m; }
  public static string List() {
    DEVMODE c = New();
    if (!EnumDisplaySettings(null, -1, ref c)) return "cur=0x0@0 modes=";
    StringBuilder sb = new StringBuilder();
    sb.Append("cur=" + c.dmPelsWidth + "x" + c.dmPelsHeight + "@" + c.dmDisplayFrequency + " modes=");
    HashSet<string> seen = new HashSet<string>();
    int i = 0;
    DEVMODE m = New();
    while (EnumDisplaySettings(null, i++, ref m)) {
      if (m.dmBitsPerPel == 32 && (m.dmDisplayFlags & 2) == 0) {
        string k = m.dmPelsWidth + "x" + m.dmPelsHeight + "@" + m.dmDisplayFrequency;
        if (seen.Add(k)) sb.Append(k + ",");
      }
      m = New();
    }
    return sb.ToString();
  }
  public static int SetMode(int w, int h, int f) {
    DEVMODE m = New();
    if (!EnumDisplaySettings(null, -1, ref m)) return -99;
    m.dmPelsWidth = w; m.dmPelsHeight = h;
    m.dmFields = 0x80000 | 0x100000;
    if (f > 0) { m.dmDisplayFrequency = f; m.dmFields |= 0x400000; }
    return CDS(ref m, 4);
  }
  public static int Reset() { return CDS0(IntPtr.Zero, 0); }
}
"@
[Console]::Out.WriteLine('READY')
while ($true) {
  $l = [Console]::In.ReadLine()
  if ($l -eq $null) { break }
  $p = $l.Trim().Split(' ')
  try {
    switch ($p[0]) {
      'list'  { [Console]::Out.WriteLine('LIST ' + [GGD]::List()) }
      'set'   { [Console]::Out.WriteLine('SET ' + [GGD]::SetMode([int]$p[1], [int]$p[2], [int]$p[3])) }
      'reset' { [Console]::Out.WriteLine('RESET ' + [GGD]::Reset()) }
    }
  } catch { [Console]::Out.WriteLine('ERR ' + $_.Exception.Message) }
  [Console]::Out.Flush()
}
[void][GGD]::Reset()
`;

class DisplayMode {
  constructor(dir) {
    this.dir = dir; this.proc = null; this.ready = null;
    this.modes = []; this.cur = null; this.changed = false;
    this.pending = []; this.buf = "";
  }
  start() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve) => {
      if (process.platform !== "win32" && !process.env.GG_DM_CMD) return resolve(false);
      try {
        let cmd, args;
        if (process.env.GG_DM_CMD) { [cmd, ...args] = JSON.parse(process.env.GG_DM_CMD); } // solo para pruebas
        else {
          fs.mkdirSync(this.dir, { recursive: true });
          const f = path.join(this.dir, "gg-display.ps1");
          fs.writeFileSync(f, "﻿" + PS);
          cmd = "powershell.exe"; args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", f];
        }
        this.proc = spawn(cmd, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
        this.err = ""; this.proc.stderr.setEncoding("utf8"); this.proc.stderr.on("data", (d) => { this.err = (this.err + d).slice(-800); });
      } catch (e) { return resolve(false); }
      this.proc.on("error", () => { this._die(); resolve(false); });
      this.proc.on("exit", () => { this._die(); resolve(false); });
      this.proc.stdin.on("error", () => {});
      this.proc.stdout.setEncoding("utf8");
      this.proc.stdout.on("data", (d) => this._data(d));
      this.req("list", 25000).then((r) => { this._parse(r); resolve(this.modes.length > 0); }).catch(() => resolve(false));
    });
    return this.ready;
  }
  _die() { this.proc = null; this.pending.splice(0).forEach((p) => p.resolve(null)); }
  _data(d) {
    this.buf += d;
    let i;
    while ((i = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1);
      if (!line || line === "READY") continue;
      const p = this.pending.shift();
      if (p) { clearTimeout(p.t); p.resolve(line); }
    }
  }
  req(cmd, ms = 8000) {
    return new Promise((resolve) => {
      if (!this.proc) return resolve(null);
      const p = { resolve, t: setTimeout(() => { const k = this.pending.indexOf(p); if (k >= 0) this.pending.splice(k, 1); resolve(null); }, ms) };
      this.pending.push(p);
      try { this.proc.stdin.write(cmd + "\n"); } catch (e) { resolve(null); }
    });
  }
  _parse(line) {
    const m = /^LIST cur=(\d+)x(\d+)@(\d+) modes=(.*)$/.exec(line || "");
    if (!m) return;
    this.cur = { w: +m[1], h: +m[2], f: +m[3] };
    this.modes = m[4].split(",").filter(Boolean).map((s) => { const q = /^(\d+)x(\d+)@(\d+)$/.exec(s); return q && { w: +q[1], h: +q[2], f: +q[3] }; }).filter(Boolean);
  }
  // Modo de monitor más parecido al pedido (misma proporción que el nativo y como mucho un 8% de diferencia de ancho).
  pick(tw, th) {
    if (!this.cur || !this.modes.length) return null;
    const asp = this.cur.w / this.cur.h;
    let best = null;
    for (const m of this.modes) {
      if (Math.abs(m.w / m.h - asp) > 0.02 || Math.abs(m.w - tw) > tw * 0.08) continue;
      const score = Math.abs(m.w - tw) * 1000 + Math.abs(m.f - this.cur.f) + (m.f > this.cur.f ? 500 : 0);
      if (!best || score < best.score) best = { ...m, score };
    }
    return best && { w: best.w, h: best.h, f: best.f };
  }
  async set(m) {
    const r = await this.req(`set ${m.w} ${m.h} ${m.f}`);
    const ok = r === "SET 0";
    if (ok) this.changed = true;
    return ok;
  }
  async reset() {
    if (!this.changed) return true;
    const r = await this.req("reset");
    this.changed = false;
    return r === "RESET 0";
  }
  // Al cerrar: se cierra la entrada del PowerShell; él mismo restaura el monitor antes de salir.
  shutdown() { try { if (this.proc) this.proc.stdin.end(); } catch (e) {} }
}

module.exports = { DisplayMode };
