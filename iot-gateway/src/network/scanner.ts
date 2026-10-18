import os from "node:os";
import net from "node:net";
import { exec } from "node:child_process";

/** Ports probed on every host; each one hints at a device kind. */
export const PROBE_PORTS: Record<number, string> = {
  80: "http",
  443: "https",
  554: "rtsp",
  8000: "hikvision",
  37777: "dahua",
  3000: "lg-webos",
  3001: "lg-webos",
  8001: "samsung-tv",
  8002: "samsung-tv",
  8008: "chromecast",
  8009: "chromecast",
  8060: "roku",
  1883: "mqtt",
  6668: "tuya",
  8123: "home-assistant",
  1984: "go2rtc",
  9999: "tplink-kasa",
  5353: "mdns",
  62078: "iphone",
  139: "smb",
  445: "smb",
  22: "ssh",
  9100: "printer",
  631: "printer",
};

export interface ScannedHost {
  ip: string;
  mac?: string;
  hostname?: string;
  openPorts: number[];
  services: string[];
  guess: { category: string; deviceType: string; label: string; protocol: string };
}

function localSubnets(): string[] {
  const prefixes = new Set<string>();
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family !== "IPv4" || i.internal) continue;
      if (/^(10|172\.(1[6-9]|2\d|3[01])|192\.168)\./.test(i.address)) {
        prefixes.add(i.address.split(".").slice(0, 3).join("."));
      }
    }
  }
  return [...prefixes];
}

function probe(ip: string, port: number, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(timeout);
    s.once("connect", () => finish(true));
    // "connection refused" still proves the host is alive
    s.once("error", (e: NodeJS.ErrnoException) => finish(e.code === "ECONNREFUSED" ? false : false));
    s.once("timeout", () => finish(false));
    s.connect(port, ip);
  });
}

function aliveByRefused(ip: string, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(timeout);
    s.once("connect", () => { s.destroy(); resolve(true); });
    s.once("error", (e: NodeJS.ErrnoException) => { s.destroy(); resolve(e.code === "ECONNREFUSED"); });
    s.once("timeout", () => { s.destroy(); resolve(false); });
    s.connect(7, ip);
  });
}

function readArp(): Promise<Map<string, string>> {
  return new Promise((resolve) => {
    exec(process.platform === "win32" ? "arp -a" : "arp -an", { timeout: 4000 }, (_e, out) => {
      const map = new Map<string, string>();
      for (const line of (out ?? "").split(/\r?\n/)) {
        const ip = line.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1];
        const mac = line.match(/([0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i)?.[0];
        if (ip && mac && !/^ff[:-]ff/i.test(mac)) map.set(ip, mac.replace(/-/g, ":").toLowerCase());
      }
      resolve(map);
    });
  });
}

export function guessDevice(ports: number[]): ScannedHost["guess"] {
  const has = (...p: number[]) => p.some((x) => ports.includes(x));
  if (has(3000, 3001, 8001, 8002, 8060)) return { category: "entretenimento", deviceType: "televisao", label: "Smart TV", protocol: "websocket" };
  if (has(8008, 8009)) return { category: "entretenimento", deviceType: "receiver", label: "Chromecast / Google", protocol: "wifi" };
  if (has(554, 8000, 37777)) return { category: "seguranca", deviceType: "camera", label: "Câmera IP / DVR", protocol: "http" };
  if (has(8123)) return { category: "outros", deviceType: "personalizado", label: "Home Assistant", protocol: "home_assistant" };
  if (has(1883)) return { category: "outros", deviceType: "personalizado", label: "Broker MQTT", protocol: "mqtt" };
  if (has(6668, 9999)) return { category: "energia", deviceType: "tomada", label: "Plug / Tomada Wi-Fi", protocol: "wifi" };
  if (has(9100, 631)) return { category: "outros", deviceType: "personalizado", label: "Impressora", protocol: "wifi" };
  if (has(62078)) return { category: "outros", deviceType: "personalizado", label: "iPhone / iPad", protocol: "wifi" };
  if (has(80, 443)) return { category: "outros", deviceType: "personalizado", label: "Dispositivo Web", protocol: "http" };
  return { category: "outros", deviceType: "personalizado", label: "Dispositivo de rede", protocol: "wifi" };
}

async function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) await fn(items[i++]!);
  }));
}

/** Sweeps every /24 the gateway machine is on and returns all responding hosts. */
export async function scanNetwork(opts: { subnets?: string[]; timeoutMs?: number } = {}): Promise<{ subnets: string[]; hosts: ScannedHost[] }> {
  const subnets = opts.subnets?.length ? opts.subnets : localSubnets();
  const timeout = opts.timeoutMs ?? 450;
  const ports = Object.keys(PROBE_PORTS).map(Number);
  const found = new Map<string, number[]>();

  const ips = subnets.flatMap((p) => Array.from({ length: 254 }, (_, k) => `${p}.${k + 1}`));
  const tasks = ips.flatMap((ip) => ports.map((port) => ({ ip, port })));
  await pool(tasks, 400, async ({ ip, port }) => {
    if (await probe(ip, port, timeout)) found.set(ip, [...(found.get(ip) ?? []), port]);
  });

  // Hosts with no open ports: anything in the ARP cache (populated by the sweep) or refusing connections
  const arp = await readArp();
  const silent = ips.filter((ip) => !found.has(ip));
  await pool(silent, 200, async (ip) => {
    if (arp.has(ip) || (await aliveByRefused(ip, timeout))) found.set(ip, []);
  });

  const hosts: ScannedHost[] = [];
  await pool([...found.keys()], 30, async (ip) => {
    const openPorts = (found.get(ip) ?? []).sort((a, b) => a - b);
    let hostname: string | undefined;
    try {
      const dns = await import("node:dns/promises");
      hostname = (await Promise.race([dns.reverse(ip), new Promise<string[]>((r) => setTimeout(() => r([]), 800))]))[0];
    } catch {}
    hosts.push({
      ip, mac: arp.get(ip), hostname, openPorts,
      services: [...new Set(openPorts.map((p) => PROBE_PORTS[p]!))],
      guess: guessDevice(openPorts),
    });
  });
  hosts.sort((a, b) => Number(a.ip.split(".").pop()) - Number(b.ip.split(".").pop()));
  return { subnets, hosts };
}
