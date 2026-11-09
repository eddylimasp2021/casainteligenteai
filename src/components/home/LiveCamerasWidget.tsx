import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Cctv, Video, ExternalLink, ShieldCheck, RefreshCw, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { INITIAL_CAMERAS, type IpCamera } from "@/types/dvr-nvr";

const CAMERAS_STORAGE_KEY = "homepulse_dvr_cameras_v1";

export function LiveCamerasWidget() {
  const [gatewayUrl, setGatewayUrl] = useState<string>("");
  const [cameras, setCameras] = useState<IpCamera[]>(() => {
    try {
      const saved = localStorage.getItem(CAMERAS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_CAMERAS.slice(0, 3);
  });
  const [timestamp, setTimestamp] = useState<number>(Date.now());

  // Load gateway URL from local storage or cloud
  useEffect(() => {
    try {
      const savedUrl = localStorage.getItem("homepulse_dvr_gateway_url_v1");
      if (savedUrl && !savedUrl.includes("cake-studied-rendered-contemporary")) {
        setGatewayUrl(savedUrl.trim().replace(/\/+$/, ""));
      }
    } catch {}
  }, []);

  // Refresh snapshots periodically (every 4 seconds for lightweight live feel)
  useEffect(() => {
    const interval = setInterval(() => {
      setTimestamp(Date.now());
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Filter top 3 physical cameras (Garagem Rua, Tripla, Externa)
  const displayCameras = cameras.slice(0, 3);

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xl overflow-hidden shadow-sm">
      <CardHeader className="p-4 sm:p-5 flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Cctv className="size-5 text-primary" />
            <span>Videomonitoramento ao Vivo</span>
            <Badge variant="outline" className="ml-1 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px] py-0">
              Ao Vivo
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Acompanhamento em tempo real das áreas críticas da residência
          </CardDescription>
        </div>
        <Link to="/dvr-nvr">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10">
            <span>Mosaico Completo</span>
            <ExternalLink className="size-3.5" />
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayCameras.map((cam) => {
            const streamName = cam.streamName || "garagem_rua";
            const snapUrl = gatewayUrl
              ? `${gatewayUrl}/api/frame.jpeg?src=${encodeURIComponent(streamName)}&_t=${timestamp}`
              : null;

            return (
              <Link
                key={cam.id}
                to="/dvr-nvr"
                className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-black/80 transition-all hover:border-primary/60 hover:shadow-md cursor-pointer"
              >
                <div className="relative aspect-video w-full bg-neutral-950 overflow-hidden flex items-center justify-center">
                  {snapUrl ? (
                    <img
                      src={snapUrl}
                      alt={cam.name}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        // Fallback placeholder on frame load error
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : null}

                  {/* Fallback Overlay Icon */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-1.5 p-3 text-center bg-neutral-900/60 pointer-events-none group-hover:bg-neutral-900/40 transition-colors">
                    <Video className="size-6 text-primary/70" />
                    <span className="text-[11px] font-medium text-neutral-300">
                      {gatewayUrl ? "Transmitindo Snapshot" : "Gateway offline"}
                    </span>
                  </div>

                  {/* Camera Name Tag */}
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-mono text-white border border-white/10 shadow">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="truncate max-w-[120px]">{cam.name}</span>
                  </div>

                  {/* Room Tag */}
                  <div className="absolute bottom-2 right-2 z-10 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-neutral-300">
                    {cam.roomName || "Externa"}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
