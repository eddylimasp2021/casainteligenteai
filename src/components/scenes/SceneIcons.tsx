import React from "react";
import {
  Film,
  Moon,
  Sun,
  Home,
  LogOut,
  PartyPopper,
  Coffee,
  Briefcase,
  Sparkles,
  Heart,
  Shield,
  Zap,
  LucideIcon,
} from "lucide-react";
import { SceneIconName, SceneColorTheme } from "@/types/scenes";
import { cn } from "@/lib/utils";

export const SCENE_ICONS_MAP: Record<SceneIconName, LucideIcon> = {
  film: Film,
  moon: Moon,
  sun: Sun,
  home: Home,
  "log-out": LogOut,
  "party-popper": PartyPopper,
  coffee: Coffee,
  briefcase: Briefcase,
  sparkles: Sparkles,
  heart: Heart,
  shield: Shield,
  zap: Zap,
};

export const SCENE_COLOR_THEMES: Record<
  SceneColorTheme,
  {
    bg: string;
    border: string;
    text: string;
    glow: string;
    badge: string;
    hover: string;
  }
> = {
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-400",
    glow: "shadow-purple-500/20",
    badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    hover: "hover:border-purple-500/50 hover:bg-purple-500/15",
  },
  indigo: {
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    text: "text-indigo-400",
    glow: "shadow-indigo-500/20",
    badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    hover: "hover:border-indigo-500/50 hover:bg-indigo-500/15",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    glow: "shadow-amber-500/20",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    hover: "hover:border-amber-500/50 hover:bg-amber-500/15",
  },
  rose: {
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    text: "text-rose-400",
    glow: "shadow-rose-500/20",
    badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    hover: "hover:border-rose-500/50 hover:bg-rose-500/15",
  },
  cyan: {
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    text: "text-cyan-400",
    glow: "shadow-cyan-500/20",
    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    hover: "hover:border-cyan-500/50 hover:bg-cyan-500/15",
  },
  emerald: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    glow: "shadow-emerald-500/20",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    hover: "hover:border-emerald-500/50 hover:bg-emerald-500/15",
  },
  orange: {
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    text: "text-orange-400",
    glow: "shadow-orange-500/20",
    badge: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    hover: "hover:border-orange-500/50 hover:bg-orange-500/15",
  },
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    glow: "shadow-blue-500/20",
    badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    hover: "hover:border-blue-500/50 hover:bg-blue-500/15",
  },
};

export function SceneIcon({
  name,
  className,
}: {
  name: SceneIconName;
  className?: string;
}) {
  const Icon = SCENE_ICONS_MAP[name] || Sparkles;
  return <Icon className={className} />;
}
