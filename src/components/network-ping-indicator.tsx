import { useEffect, useRef, useState, useTransition } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Wifi,
  WifiOff,
  Radio,
  Share2,
  Copy,
  Check,
  Download,
  ExternalLink,
  RefreshCw,
  Server,
  Activity,
  Globe,
  Smartphone,
  Info,
  Laptop,
  QrCode,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND, useHospitalBrand } from "@/components/brand";

export type PingStatus = "excellent" | "good" | "fair" | "poor" | "offline";

interface NetworkMetrics {
  currentPing: number | null;
  avgPing: number | null;
  minPing: number | null;
  maxPing: number | null;
  jitter: number | null;
  history: number[];
  isOnline: boolean;
  status: PingStatus;
  lastChecked: Date | null;
}

export function NetworkPingIndicator() {
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<NetworkMetrics>({
    currentPing: null,
    avgPing: null,
    minPing: null,
    maxPing: null,
    jitter: null,
    history: [],
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    status: "good",
    lastChecked: null,
  });

  const [isChecking, setIsChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [urlMode, setUrlMode] = useState<"current" | "home" | "lan">("current");
  const [lanIp, setLanIp] = useState<string>("");
  const [, startTransition] = useTransition();
  const { data: brand } = useHospitalBrand();
  const qrRef = useRef<SVGSVGElement | null>(null);

  // Measure latency to local server / origin
  const measurePing = async (): Promise<number | null> => {
    if (typeof window === "undefined") return null;
    if (!navigator.onLine) {
      setMetrics((prev) => ({
        ...prev,
        isOnline: false,
        status: "offline",
        currentPing: null,
      }));
      return null;
    }

    setIsChecking(true);
    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      // Ping cache-busted origin with lightweight HEAD request
      const pingUrl = `${window.location.origin}/?_ping=${Date.now()}`;
      await fetch(pingUrl, {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const endTime = performance.now();
      const latency = Math.max(1, Math.round(endTime - startTime));

      let status: PingStatus = "good";
      if (latency < 80) status = "excellent";
      else if (latency < 180) status = "good";
      else if (latency < 350) status = "fair";
      else status = "poor";

      setMetrics((prev) => {
        const nextHistory = [...prev.history.slice(-9), latency];
        const sum = nextHistory.reduce((a, b) => a + b, 0);
        const avg = Math.round(sum / nextHistory.length);
        const min = Math.min(...nextHistory);
        const max = Math.max(...nextHistory);
        
        let jitter = 0;
        if (nextHistory.length > 1) {
          let diffSum = 0;
          for (let i = 1; i < nextHistory.length; i++) {
            diffSum += Math.abs(nextHistory[i] - nextHistory[i - 1]);
          }
          jitter = Math.round(diffSum / (nextHistory.length - 1));
        }

        return {
          currentPing: latency,
          avgPing: avg,
          minPing: min,
          maxPing: max,
          jitter,
          history: nextHistory,
          isOnline: true,
          status,
          lastChecked: new Date(),
        };
      });

      return latency;
    } catch {
      clearTimeout(timeoutId);
      setMetrics((prev) => ({
        ...prev,
        status: navigator.onLine ? "poor" : "offline",
        isOnline: navigator.onLine,
        lastChecked: new Date(),
      }));
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  // Periodic ping interval
  useEffect(() => {
    measurePing();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        measurePing();
      }
    }, 10000);

    const handleOnline = () => {
      setMetrics((prev) => ({ ...prev, isOnline: true }));
      measurePing();
    };
    const handleOffline = () => {
      setMetrics((prev) => ({ ...prev, isOnline: false, status: "offline", currentPing: null }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Compute shareable URL based on mode
  const getShareUrl = () => {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    const currentFull = window.location.href;

    if (urlMode === "home") {
      return origin;
    }

    if (urlMode === "lan") {
      const port = window.location.port ? `:${window.location.port}` : "";
      const path = window.location.pathname;
      const targetHost = lanIp.trim() || (window.location.hostname === "localhost" ? "192.168.1.100" : window.location.hostname);
      return `${window.location.protocol}//${targetHost}${port}${path === "/" ? "" : path}`;
    }

    return currentFull;
  };

  const shareUrl = getShareUrl();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!", {
        description: shareUrl,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: brand?.name || BRAND.name,
          text: `Connect to ${brand?.name || BRAND.name} Hospital Management Suite`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed silently
      }
    } else {
      handleCopy();
    }
  };

  const downloadQrCode = () => {
    try {
      const svg = qrRef.current;
      if (!svg) return;

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        canvas.width = 600;
        canvas.height = 600;
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 40, 40, 520, 520);
        }
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `${(brand?.name || BRAND.name).toLowerCase().replace(/\s+/g, "-")}-qr-code.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        toast.success("QR Code downloaded as PNG");
      };

      img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
    } catch {
      toast.error("Could not generate downloadable image");
    }
  };

  // Status color styles
  const statusStyles: Record<PingStatus, { bg: string; text: string; dot: string; label: string }> = {
    excellent: {
      bg: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
      dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]",
      text: "text-emerald-600 dark:text-emerald-400",
      label: "Excellent",
    },
    good: {
      bg: "bg-teal-500/10 hover:bg-teal-500/20 border-teal-500/30 text-teal-600 dark:text-teal-400",
      dot: "bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.7)]",
      text: "text-teal-600 dark:text-teal-400",
      label: "Good",
    },
    fair: {
      bg: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]",
      text: "text-amber-600 dark:text-amber-400",
      label: "Fair Latency",
    },
    poor: {
      bg: "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-600 dark:text-rose-400",
      dot: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]",
      text: "text-rose-600 dark:text-rose-400",
      label: "High Latency",
    },
    offline: {
      bg: "bg-destructive/10 hover:bg-destructive/20 border-destructive/30 text-destructive",
      dot: "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.7)]",
      text: "text-destructive",
      label: "Offline",
    },
  };

  const currentStyle = statusStyles[metrics.status];

  // Optional connection type detection (if supported by modern browser)
  const navConn = typeof navigator !== "undefined" ? (navigator as any).connection : null;
  const connectionType = navConn?.effectiveType ? navConn.effectiveType.toUpperCase() : "Wi-Fi / LAN";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-9 px-2.5 sm:px-3 rounded-full border transition-all gap-1.5 sm:gap-2 shadow-xs cursor-pointer select-none ${currentStyle.bg}`}
              aria-label="Network Ping & Share QR Code"
            >
              {/* Pulse / Ping Animation Dot */}
              <span className="relative flex size-2.5">
                {metrics.isOnline && (
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${currentStyle.dot}`}
                  />
                )}
                <span className={`relative inline-flex rounded-full size-2.5 ${currentStyle.dot}`} />
              </span>

              {/* Icon & Ping Display */}
              {metrics.isOnline ? (
                <Wifi className={`size-3.5 ${isChecking ? "animate-pulse" : ""}`} />
              ) : (
                <WifiOff className="size-3.5 text-destructive" />
              )}

              <span className="font-semibold text-xs tracking-tight tabular-nums">
                {metrics.isOnline
                  ? metrics.currentPing !== null
                    ? `${metrics.currentPing} ms`
                    : "Live"
                  : "Offline"}
              </span>

              <QrCode className="size-3.5 opacity-60 hidden md:inline-block ml-0.5" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">
              Network Status: {currentStyle.label} ({metrics.currentPing ? `${metrics.currentPing}ms` : "Offline"})
            </span>
            <span className="text-[11px] text-muted-foreground">
              Click to share network access & direct scan QR code
            </span>
          </div>
        </TooltipContent>
      </Tooltip>

      <DialogContent className="max-w-md sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl border bg-background shadow-2xl">
        {/* Header with decorative network styling */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-surface p-5 sm:p-6 border-b border-border/80 relative">
          <DialogHeader className="space-y-1.5 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shadow-xs">
                  <Radio className="size-4.5 animate-pulse" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold tracking-tight">
                    Network Sharing & Direct QR Scan
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Connect tablets, smartphones & local devices to CareFlow Suite
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Quick status bar */}
          <div className="mt-4 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-background/80 backdrop-blur border border-border/60 text-xs">
            <div className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${currentStyle.dot}`} />
              <span className="font-medium text-foreground">
                {metrics.isOnline ? "Network Connected" : "No Connection"}
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                {metrics.currentPing !== null ? `${metrics.currentPing} ms latency` : currentStyle.label}
              </Badge>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => measurePing()}
              disabled={isChecking}
            >
              <RefreshCw className={`size-3 ${isChecking ? "animate-spin text-primary" : ""}`} />
              {isChecking ? "Testing…" : "Test Ping"}
            </Button>
          </div>
        </div>

        {/* Tabs for QR Sharing vs Live Network Diagnostics */}
        <div className="p-5 sm:p-6">
          <Tabs defaultValue="qr" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="qr" className="gap-2 text-xs sm:text-sm">
                <QrCode className="size-4" /> Direct QR Scan
              </TabsTrigger>
              <TabsTrigger value="diagnostics" className="gap-2 text-xs sm:text-sm">
                <Activity className="size-4" /> Live Ping & Telemetry
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: QR Direct Scan */}
            <TabsContent value="qr" className="space-y-4 m-0 focus-visible:outline-none">
              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-4 bg-gradient-to-b from-muted/30 to-muted/60 rounded-2xl border border-border/60">
                <div className="p-3.5 bg-white rounded-2xl shadow-md border border-neutral-200/80 flex items-center justify-center transition-transform hover:scale-[1.02]">
                  <QRCodeSVG
                    ref={qrRef}
                    value={shareUrl || "https://careflow.sbg.hospital"}
                    size={200}
                    level="H"
                    includeMargin={false}
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                    imageSettings={{
                      src: brand?.logoUrl || BRAND.logoUrl,
                      x: undefined,
                      y: undefined,
                      height: 36,
                      width: 36,
                      excavate: true,
                    }}
                  />
                </div>

                <p className="text-xs text-muted-foreground text-center mt-3 max-w-xs leading-relaxed">
                  Point any phone camera or tablet at this QR code to instantly launch this CareFlow Suite instance.
                </p>
              </div>

              {/* URL Scope Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Share Target URL
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {urlMode === "current" && "Exact Current Route"}
                    {urlMode === "home" && "Dashboard / Login Root"}
                    {urlMode === "lan" && "Hospital Wi-Fi / LAN IP"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/50 text-xs">
                  <button
                    type="button"
                    onClick={() => startTransition(() => setUrlMode("current"))}
                    className={`py-1.5 px-2 rounded-lg font-medium transition-all text-center ${
                      urlMode === "current"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Current Page
                  </button>
                  <button
                    type="button"
                    onClick={() => startTransition(() => setUrlMode("home"))}
                    className={`py-1.5 px-2 rounded-lg font-medium transition-all text-center ${
                      urlMode === "home"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Root Home
                  </button>
                  <button
                    type="button"
                    onClick={() => startTransition(() => setUrlMode("lan"))}
                    className={`py-1.5 px-2 rounded-lg font-medium transition-all text-center ${
                      urlMode === "lan"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Wi-Fi / LAN
                  </button>
                </div>

                {/* LAN IP input if in LAN mode */}
                {urlMode === "lan" && (
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-primary">
                      <Smartphone className="size-3.5" /> Mobile Wi-Fi Device Access
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      If testing locally, enter your computer&apos;s local Wi-Fi IP (e.g. <code>192.168.1.15</code>) so mobile devices on the same Wi-Fi can open the URL:
                    </p>
                    <Input
                      placeholder="e.g. 192.168.1.100"
                      value={lanIp}
                      onChange={(e) => setLanIp(e.target.value)}
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                )}

                {/* URL Display & Action Bar */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="relative flex-1">
                    <Input
                      readOnly
                      value={shareUrl}
                      className="h-9 pr-9 text-xs font-mono bg-muted/40 text-ellipsis truncate"
                    />
                  </div>

                  <Button
                    size="sm"
                    variant={copied ? "default" : "outline"}
                    className="h-9 px-3 gap-1.5 text-xs shrink-0 cursor-pointer"
                    onClick={handleCopy}
                  >
                    {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>

              {/* Action Buttons: Native Share, Download QR, Open in New Tab */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8.5 text-xs gap-1.5 cursor-pointer hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                  onClick={handleNativeShare}
                >
                  <Share2 className="size-3.5" /> Share
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8.5 text-xs gap-1.5 cursor-pointer hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                  onClick={downloadQrCode}
                >
                  <Download className="size-3.5" /> Download QR
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8.5 text-xs gap-1.5 cursor-pointer"
                  asChild
                >
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" /> Open Tab
                  </a>
                </Button>
              </div>
            </TabsContent>

            {/* TAB 2: Live Ping & Telemetry */}
            <TabsContent value="diagnostics" className="space-y-4 m-0 focus-visible:outline-none">
              {/* Telemetry Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                  <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                    <Activity className="size-3 text-primary" /> Current Ping
                  </div>
                  <div className="text-xl font-bold mt-1 text-foreground tabular-nums">
                    {metrics.currentPing !== null ? `${metrics.currentPing} ms` : "—"}
                  </div>
                  <span className={`text-[10px] font-semibold ${currentStyle.text}`}>
                    {currentStyle.label}
                  </span>
                </div>

                <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                  <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                    <Layers className="size-3 text-teal-500" /> Avg Latency
                  </div>
                  <div className="text-xl font-bold mt-1 text-foreground tabular-nums">
                    {metrics.avgPing !== null ? `${metrics.avgPing} ms` : "—"}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Rolling 10 samples</span>
                </div>

                <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                  <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                    <Radio className="size-3 text-amber-500" /> Jitter (Var)
                  </div>
                  <div className="text-xl font-bold mt-1 text-foreground tabular-nums">
                    {metrics.jitter !== null ? `±${metrics.jitter} ms` : "0 ms"}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Stability index</span>
                </div>

                <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                  <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                    <Server className="size-3 text-indigo-500" /> Min / Max
                  </div>
                  <div className="text-sm font-bold mt-1.5 text-foreground tabular-nums">
                    {metrics.minPing !== null ? `${metrics.minPing} / ${metrics.maxPing} ms` : "—"}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Best / Peak</span>
                </div>
              </div>

              {/* Ping History Visualization Bar */}
              {metrics.history.length > 0 && (
                <div className="p-3.5 bg-muted/30 rounded-xl border border-border/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">Recent Ping History</span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Last: {metrics.currentPing}ms
                    </span>
                  </div>
                  <div className="flex items-end gap-1.5 h-14 pt-2">
                    {metrics.history.map((ping, idx) => {
                      const maxHistory = Math.max(...metrics.history, 150);
                      const heightPercent = Math.min(100, Math.max(15, Math.round((ping / maxHistory) * 100)));
                      const isLast = idx === metrics.history.length - 1;
                      let barBg = "bg-emerald-500";
                      if (ping >= 180) barBg = "bg-amber-500";
                      if (ping >= 350) barBg = "bg-rose-500";

                      return (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative"
                        >
                          <div
                            className={`w-full rounded-t-sm transition-all duration-300 ${barBg} ${
                              isLast ? "opacity-100 ring-2 ring-primary/40" : "opacity-75 hover:opacity-100"
                            }`}
                            style={{ height: `${heightPercent}%` }}
                          />
                          <span className="text-[9px] text-muted-foreground font-mono group-hover:text-foreground">
                            {ping}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* System & Connection Environment Info */}
              <div className="divide-y rounded-xl border bg-card text-xs">
                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Globe className="size-3.5 text-primary" /> Application Host
                  </span>
                  <span className="font-mono font-medium">{typeof window !== "undefined" ? window.location.hostname : "localhost"}</span>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Wifi className="size-3.5 text-teal-500" /> Network Protocol & Type
                  </span>
                  <span className="font-medium">
                    {typeof window !== "undefined" ? window.location.protocol.toUpperCase().replace(":", "") : "HTTP"} • {connectionType}
                  </span>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-emerald-500" /> Cloud Database Connection
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <span className="size-1.5 rounded-full bg-emerald-500" /> Supabase Realtime Active
                  </span>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Laptop className="size-3.5 text-muted-foreground" /> Station Mode
                  </span>
                  <span className="font-medium">Hospital Workstation / Client</span>
                </div>
              </div>

              {/* Ping Test Button */}
              <Button
                className="w-full h-9 text-xs gap-2 cursor-pointer"
                onClick={() => measurePing()}
                disabled={isChecking}
              >
                <RefreshCw className={`size-3.5 ${isChecking ? "animate-spin" : ""}`} />
                {isChecking ? "Measuring Latency…" : "Perform Live Latency Test"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
