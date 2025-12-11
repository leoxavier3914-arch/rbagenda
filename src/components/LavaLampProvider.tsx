"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

type LavaInstance = {
  reseed: () => void;
};

type LavaController = {
  greens: string[];
  accents: string[];
  instances: LavaInstance[];
  reseedAll: () => void;
  syncPaletteFromVars: () => void;
};

type LavaLampContextValue = {
  refreshPalette: () => void;
};

const LavaLampContext = createContext<LavaLampContextValue | undefined>(
  undefined,
);

const steps = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.85, 0.92, 0.97] as const;

const normalizeHex = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 4 && trimmed.startsWith("#")) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toUpperCase();
  }
  if (trimmed.length === 3) {
    return `#${trimmed[0]}${trimmed[0]}${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}`.toUpperCase();
  }
  return trimmed.toUpperCase();
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeHex(hex).replace("#", "");
  const value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const mixHexColors = (colorA: string, colorB: string, ratio: number) => {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const mixChannel = (channelA: number, channelB: number) =>
    Math.round(channelA + (channelB - channelA) * ratio);
  return `#${[mixChannel(a.r, b.r), mixChannel(a.g, b.g), mixChannel(a.b, b.b)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
};

const buildPalette = () => {
  const computed = getComputedStyle(document.documentElement);
  const dark = computed.getPropertyValue("--dark").trim() || "#7aa98a";
  const light = computed.getPropertyValue("--light").trim() || "#bcd6c3";
  return steps.map((step) => mixHexColors(dark, light, step));
};

export const useLavaLamp = () => {
  const context = useContext(LavaLampContext);
  if (!context) {
    throw new Error("useLavaLamp must be used within a LavaLampProvider");
  }
  return context;
};

type LavaLampProviderProps = {
  children: ReactNode;
};

export function LavaLampProvider({ children }: LavaLampProviderProps) {
  const darkRef = useRef<HTMLCanvasElement | null>(null);
  const lightRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<LavaController | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const cleanupFns: Array<() => void> = [];
    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    const controller: LavaController = {
      greens: [],
      accents: ["rgba(255,255,255,0.5)", "rgba(0,0,0,0.2)"],
      instances: [],
      reseedAll() {
        this.instances.forEach((instance) => instance.reseed());
      },
      syncPaletteFromVars() {
        this.greens = buildPalette();
        this.reseedAll();
      },
    };

    controllerRef.current = controller;

    const LAVA_CONFIG = {
      dark: { count: 24, radius: [90, 150] as [number, number], speed: 1.2 },
      light: { count: 22, radius: [80, 130] as [number, number], speed: 1.0 },
    } as const;

    type LavaBlob = {
      x: number;
      y: number;
      r: number;
      a: number;
      vx: number;
      vy: number;
      color: string;
      opacity: number;
    };

    type LavaLayerState = {
      width: number;
      height: number;
      blobs: LavaBlob[];
      time: number;
      raf?: number;
      destroyed: boolean;
    };

    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const pick = <T,>(values: readonly T[]) =>
      values[Math.floor(Math.random() * values.length)];

    const createLavaLayer = (
      canvas: HTMLCanvasElement | null,
      type: "dark" | "light",
    ) => {
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;

      const state: LavaLayerState = {
        width: 0,
        height: 0,
        blobs: [],
        time: 0,
        destroyed: false,
      };

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        state.width = Math.ceil(rect.width * devicePixelRatio);
        state.height = Math.ceil(rect.height * devicePixelRatio);
        canvas.width = state.width;
        canvas.height = state.height;
        canvas.style.transform = "translateZ(0)";
      };

      const reseed = () => {
        const config = LAVA_CONFIG[type];
        const computed = getComputedStyle(document.documentElement);
        const minOpacity =
          parseFloat(computed.getPropertyValue("--lava-alpha-min")) || 0.4;
        const maxOpacity =
          parseFloat(computed.getPropertyValue("--lava-alpha-max")) || 0.85;

        resize();
        state.blobs = [];
        for (let index = 0; index < config.count; index += 1) {
          state.blobs.push({
            x: rand(0, state.width),
            y: rand(0, state.height),
            r: rand(config.radius[0], config.radius[1]) * devicePixelRatio,
            a: rand(0, Math.PI * 2),
            vx: rand(-1, 1) * config.speed * devicePixelRatio,
            vy: rand(-1, 1) * config.speed * devicePixelRatio,
            color: pick([...controller.greens, ...controller.accents]),
            opacity: rand(minOpacity, maxOpacity),
          });
        }
      };

      const tick = () => {
        if (state.destroyed) return;
        state.time += 1;
        context.clearRect(0, 0, state.width, state.height);
        context.globalCompositeOperation = "lighter";
        for (const blob of state.blobs) {
          blob.x += blob.vx;
          blob.y += blob.vy;
          const bounds = 200 * devicePixelRatio;
          if (blob.x < -bounds || blob.x > state.width + bounds) blob.vx *= -1;
          if (blob.y < -bounds || blob.y > state.height + bounds) blob.vy *= -1;
          const projectedRadius =
            blob.r * (1 + Math.sin(state.time * 0.02 + blob.a) * 0.05);
          context.globalAlpha = blob.opacity;
          context.fillStyle = blob.color;
          context.beginPath();
          context.arc(blob.x, blob.y, projectedRadius, 0, Math.PI * 2);
          context.fill();
        }
        state.raf = window.requestAnimationFrame(tick);
      };

      const resizeHandler = () => resize();
      window.addEventListener("resize", resizeHandler);
      cleanupFns.push(() => {
        window.removeEventListener("resize", resizeHandler);
        state.destroyed = true;
        if (state.raf) window.cancelAnimationFrame(state.raf);
      });

      const instance: LavaInstance = { reseed };
      controller.instances.push(instance);

      reseed();
      tick();
    };

    controller.greens = buildPalette();
    createLavaLayer(darkRef.current, "dark");
    createLavaLayer(lightRef.current, "light");
    controller.syncPaletteFromVars();

    return () => {
      cleanupFns.forEach((fn) => fn());
      controller.instances = [];
      controllerRef.current = null;
    };
  }, []);

  const refreshPalette = useCallback(() => {
    controllerRef.current?.syncPaletteFromVars();
  }, []);

  const contextValue = useMemo(
    () => ({ refreshPalette }),
    [refreshPalette],
  );

  return (
    <LavaLampContext.Provider value={contextValue}>
      <div className="lava-root">
        <div className="texture" aria-hidden="true">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <filter id="mottle" x="-50%" y="-50%" width="200%" height="200%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.02"
                  numOctaves="2"
                  seed="11"
                  result="turb"
                />
                <feGaussianBlur stdDeviation="18" in="turb" result="blur" />
                <feBlend in="SourceGraphic" in2="blur" mode="multiply" />
              </filter>
            </defs>
            <rect
              x="0"
              y="0"
              width="100"
              height="100"
              fill="#e9f3ee"
              filter="url(#mottle)"
            />
          </svg>
        </div>
        <div className="lamp" aria-hidden="true">
          <canvas ref={darkRef} id="lavaDark" className="lava dark" />
          <canvas ref={lightRef} id="lavaLight" className="lava light" />
        </div>
        {children}
      </div>
    </LavaLampContext.Provider>
  );
}

export default LavaLampProvider;
