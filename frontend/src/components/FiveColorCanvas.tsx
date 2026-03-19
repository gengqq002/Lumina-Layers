/**
 * FiveColorCanvas - 五色配方 3D 薄片叠加动画。
 * 用 Canvas 2D 绘制 5 层半透明薄片，选满后播放叠加动画，融合成结果颜色。
 */

import { useRef, useEffect, useCallback, useState } from "react";

interface SliceColor {
  hex: string;
  name: string;
}

interface FiveColorCanvasProps {
  /** 已选颜色（0~5 个） */
  slices: SliceColor[];
  /** 查询结果颜色 hex */
  resultHex: string | null;
  /** 是否正在查询 */
  isLoading: boolean;
}

// ===== 常量 =====
const SLICE_W = 160;
const SLICE_H = 24;
const SLICE_SKEW = 20; // 3D 倾斜偏移
const SLICE_GAP = 6;
const CORNER_R = 6;

/** 绘制一个带圆角的平行四边形薄片 */
function drawSlice(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  skew: number,
  r: number,
  color: string,
  alpha: number,
  shadow: boolean,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;
  }

  // 平行四边形四个角
  const tl = { x: x + skew, y };
  const tr = { x: x + w + skew, y };
  const br = { x: x + w, y: y + h };
  const bl = { x: x, y: y + h };

  ctx.beginPath();
  ctx.moveTo(tl.x + r, tl.y);
  ctx.lineTo(tr.x - r, tr.y);
  ctx.quadraticCurveTo(tr.x, tr.y, tr.x, tr.y + r);
  ctx.lineTo(br.x, br.y - r);
  ctx.quadraticCurveTo(br.x, br.y, br.x - r, br.y);
  ctx.lineTo(bl.x + r, bl.y);
  ctx.quadraticCurveTo(bl.x, bl.y, bl.x, bl.y - r);
  ctx.lineTo(tl.x, tl.y + r);
  ctx.quadraticCurveTo(tl.x, tl.y, tl.x + r, tl.y);
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();

  // 顶部高光
  const grad = ctx.createLinearGradient(tl.x, tl.y, bl.x, bl.y);
  grad.addColorStop(0, "rgba(255,255,255,0.35)");
  grad.addColorStop(0.5, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.1)");
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.restore();
}

/** 绘制结果圆形色块 */
function drawResultCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  progress: number, // 0~1
) {
  ctx.save();
  const r = radius * progress;

  // 外发光
  ctx.shadowColor = color;
  ctx.shadowBlur = 10 * progress;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = progress;
  ctx.fill();

  // 高光
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  grad.addColorStop(0, "rgba(255,255,255,0.4)");
  grad.addColorStop(0.6, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.restore();
}

export default function FiveColorCanvas({ slices, resultHex, isLoading }: FiveColorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef<"idle" | "stacking" | "merging" | "done">("idle");
  const progressRef = useRef(0);
  const prevSliceCountRef = useRef(0);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const [animationEpoch, setAnimationEpoch] = useState(0);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);

    if (
      canvas.width === pixelWidth &&
      canvas.height === pixelHeight &&
      sizeRef.current.width === width &&
      sizeRef.current.height === height &&
      sizeRef.current.dpr === dpr
    ) {
      return false;
    }

    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    sizeRef.current = { width, height, dpr };
    return true;
  }, []);

  const draw = useCallback((timestamp: number = Date.now()) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (sizeRef.current.width === 0 || sizeRef.current.height === 0) {
      resizeCanvas();
    }

    const { width: w, height: h, dpr } = sizeRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, w, h);

    const isDark = document.documentElement.classList.contains("dark");
    const textColor = isDark ? "#fff" : "#1f2937";
    const mutedTextColor = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)";
    const emptySliceColor = isDark ? "#374151" : "#d1d5db";
    const loadingTextColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";

    const centerX = w / 2 - SLICE_W / 2 - SLICE_SKEW / 2;
    const totalStackH = 5 * SLICE_H + 4 * SLICE_GAP;
    const startY = h * 0.3 - totalStackH / 2;

    const phase = phaseRef.current;
    const progress = progressRef.current;

    if (slices.length === 0 && !resultHex) {
      // 空状态：绘制 5 个灰色占位薄片
      for (let i = 0; i < 5; i++) {
        const y = startY + i * (SLICE_H + SLICE_GAP);
        drawSlice(ctx, centerX, y, SLICE_W, SLICE_H, SLICE_SKEW, CORNER_R, emptySliceColor, 0.4, false);
        // 序号
        ctx.fillStyle = mutedTextColor;
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(i + 1), centerX + SLICE_W / 2 + SLICE_SKEW / 2, y + SLICE_H / 2 + 4);
      }
      return;
    }

    if (phase === "merging" || phase === "done") {
      // 合并动画：薄片向中心收缩
      const mergeY = startY + 2 * (SLICE_H + SLICE_GAP); // 中间位置
      for (let i = 0; i < slices.length; i++) {
        const originalY = startY + i * (SLICE_H + SLICE_GAP);
        const currentY = originalY + (mergeY - originalY) * Math.min(progress * 2, 1);
        const alpha = Math.max(1 - progress * 1.5, 0);
        drawSlice(ctx, centerX, currentY, SLICE_W, SLICE_H, SLICE_SKEW, CORNER_R, slices[i].hex, alpha, true);
      }

      // 结果圆形
      if (resultHex && progress > 0.3) {
        const circleProgress = Math.min((progress - 0.3) / 0.7, 1);
        const eased = 1 - Math.pow(1 - circleProgress, 3); // easeOutCubic
        drawResultCircle(
          ctx,
          w / 2,
          startY + totalStackH / 2,
          50,
          resultHex,
          eased,
        );

        // 结果文字
        if (circleProgress > 0.5) {
          const textAlpha = Math.min((circleProgress - 0.5) / 0.5, 1);
          ctx.save();
          ctx.globalAlpha = textAlpha;
          ctx.fillStyle = textColor;
          ctx.font = "bold 14px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(resultHex, w / 2, startY + totalStackH / 2 + 70);
          ctx.restore();
        }
      }
    } else {
      // 正常堆叠状态
      for (let i = 0; i < 5; i++) {
        const y = startY + i * (SLICE_H + SLICE_GAP);
        if (i < slices.length) {
          // 入场动画
          const isNew = i === slices.length - 1 && phase === "stacking";
          const entryProgress = isNew ? Math.min(progress / 0.3, 1) : 1;
          const eased = 1 - Math.pow(1 - entryProgress, 3);
          const offsetX = (1 - eased) * 80;
          const alpha = eased;
          drawSlice(ctx, centerX + offsetX, y, SLICE_W, SLICE_H, SLICE_SKEW, CORNER_R, slices[i].hex, alpha, true);
          // 颜色名
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = textColor;
          ctx.font = "11px sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(slices[i].name, centerX + SLICE_W + SLICE_SKEW + 12, y + SLICE_H / 2 + 4);
          ctx.restore();
        } else {
          // 空位
          drawSlice(ctx, centerX, y, SLICE_W, SLICE_H, SLICE_SKEW, CORNER_R, emptySliceColor, 0.25, false);
          ctx.fillStyle = mutedTextColor;
          ctx.font = "12px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(String(i + 1), centerX + SLICE_W / 2 + SLICE_SKEW / 2, y + SLICE_H / 2 + 4);
        }
      }
    }

    // Loading 指示
    if (isLoading) {
      ctx.save();
      ctx.fillStyle = loadingTextColor;
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      const dots = ".".repeat(Math.floor((timestamp / 400) % 4));
      ctx.fillText(`查询中${dots}`, w / 2, h - 30);
      ctx.restore();
    }
  }, [isLoading, resizeCanvas, resultHex, slices]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncSize = () => {
      const resized = resizeCanvas();
      if (resized) {
        draw();
      }
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(canvas);
    window.addEventListener("resize", syncSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncSize);
    };
  }, [draw, resizeCanvas]);

  useEffect(() => {
    const shouldAnimate =
      phaseRef.current === "stacking" ||
      phaseRef.current === "merging" ||
      isLoading;

    if (!shouldAnimate) {
      draw();
      return;
    }

    let frame = 0;
    const loop = (timestamp: number) => {
      const phase = phaseRef.current;

      if (phase === "stacking") {
        progressRef.current = Math.min(progressRef.current + 0.04, 1);
        if (progressRef.current >= 1) phaseRef.current = "idle";
      } else if (phase === "merging") {
        progressRef.current = Math.min(progressRef.current + 0.015, 1);
        if (progressRef.current >= 1) phaseRef.current = "done";
      }

      draw(timestamp);

      if (
        phaseRef.current === "stacking" ||
        phaseRef.current === "merging" ||
        isLoading
      ) {
        frame = requestAnimationFrame(loop);
        animRef.current = frame;
      }
    };

    frame = requestAnimationFrame(loop);
    animRef.current = frame;
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [animationEpoch, draw, isLoading]);

  useEffect(() => {
    if (isLoading) {
      setAnimationEpoch((value) => value + 1);
      return;
    }
    draw();
  }, [draw, isLoading]);

  // 新增颜色时触发入场动画
  useEffect(() => {
    if (slices.length > prevSliceCountRef.current && slices.length <= 5) {
      phaseRef.current = "stacking";
      progressRef.current = 0;
      setAnimationEpoch((value) => value + 1);
    }
    prevSliceCountRef.current = slices.length;
  }, [slices.length]);

  // 有结果时触发合并动画
  useEffect(() => {
    if (resultHex && slices.length === 5) {
      phaseRef.current = "merging";
      progressRef.current = 0;
      setAnimationEpoch((value) => value + 1);
    }
    // 结果被清除（如反序操作），重置回正常堆叠
    if (!resultHex && slices.length === 5 && (phaseRef.current === "merging" || phaseRef.current === "done")) {
      phaseRef.current = "idle";
      progressRef.current = 0;
      draw();
    }
  }, [draw, resultHex, slices.length]);

  // 清除时重置
  useEffect(() => {
    if (slices.length === 0) {
      phaseRef.current = "idle";
      progressRef.current = 0;
      draw();
    }
  }, [draw, slices.length]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}
