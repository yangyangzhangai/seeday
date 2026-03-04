import React, { useRef, useEffect, useCallback } from 'react';

export type AnimationPhase = 'gathering' | 'flying' | 'condensing' | 'complete';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  opacity: number;
}

interface StardustAnimationProps {
  isActive: boolean;
  sourceRect: DOMRect | null;       // 动画起点（气泡位置）
  targetRect: DOMRect | null;       // 动画终点（消息卡片位置）
  emojiChar: string;                // 最终显示的Emoji
  onComplete?: () => void;          // 动画完成回调
  onPhaseChange?: (phase: AnimationPhase) => void; // 阶段变化回调
  isLowEndDevice?: boolean;         // 是否为低端设备（降级动画）
}

/**
 * 星尘凝结动画组件
 * 
 * 三段式动画实现：
 * 1. 光芒汇聚（0.15s）：文字淡出，中心生成光球
 * 2. 光迹飞行（0.5s）：光球沿贝塞尔曲线飞行，带拖尾
 * 3. 落地凝结（0.25s）：光球炸开，Emoji弹性弹出
 * 
 * 总时长：~0.9s
 */
export const StardustAnimation: React.FC<StardustAnimationProps> = ({
  isActive,
  sourceRect,
  targetRect,
  emojiChar,
  onComplete,
  onPhaseChange,
  isLowEndDevice = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const phaseRef = useRef<AnimationPhase>('gathering');
  const startTimeRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const lightBallRef = useRef({ x: 0, y: 0, size: 0, opacity: 0 });

  // 动画时长配置
  const DURATIONS = {
    gathering: 150,  // 0.15s
    flying: 500,     // 0.5s
    condensing: 250, // 0.25s
  };

  // 计算贝塞尔曲线路径点
  const calculateBezierPoint = useCallback((
    t: number,
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ) => {
    const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
    const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
    return { x, y };
  }, []);

  // 创建粒子
  const createParticle = useCallback((x: number, y: number, vx: number, vy: number): Particle => ({
    x,
    y,
    vx,
    vy,
    life: 1,
    maxLife: 30 + Math.random() * 20,
    size: 2 + Math.random() * 4,
    opacity: 0.8 + Math.random() * 0.2,
  }), []);

  // 创建光球拖尾粒子
  const createTrailParticles = useCallback((x: number, y: number, speed: number) => {
    if (isLowEndDevice) return; // 低端设备不生成拖尾
    
    const particleCount = Math.min(3, Math.floor(speed / 3));
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push(createParticle(
        x + (Math.random() - 0.5) * 10,
        y + (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2 + speed * 0.1
      ));
    }
  }, [createParticle, isLowEndDevice]);

  // 渲染函数
  const render = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!sourceRect || !targetRect) return;

    const elapsed = Date.now() - startTimeRef.current;
    let phase = phaseRef.current;

    // 计算当前阶段
    if (elapsed < DURATIONS.gathering) {
      phase = 'gathering';
    } else if (elapsed < DURATIONS.gathering + DURATIONS.flying) {
      phase = 'flying';
    } else if (elapsed < DURATIONS.gathering + DURATIONS.flying + DURATIONS.condensing) {
      phase = 'condensing';
    } else {
      phase = 'complete';
    }

    // 阶段变化回调
    if (phase !== phaseRef.current) {
      phaseRef.current = phase;
      onPhaseChange?.(phase);
    }

    // 动画完成
    if (phase === 'complete') {
      onComplete?.();
      return;
    }

    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;

    // 阶段一：光芒汇聚
    if (phase === 'gathering') {
      const progress = elapsed / DURATIONS.gathering;
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out

      // 光球从0放大到1
      lightBallRef.current = {
        x: sourceX,
        y: sourceY,
        size: 10 + eased * 20,
        opacity: eased,
      };

      // 绘制光球
      const gradient = ctx.createRadialGradient(
        sourceX, sourceY, 0,
        sourceX, sourceY, lightBallRef.current.size * 2
      );
      gradient.addColorStop(0, `rgba(255, 255, 200, ${lightBallRef.current.opacity})`);
      gradient.addColorStop(0.3, `rgba(255, 200, 100, ${lightBallRef.current.opacity * 0.6})`);
      gradient.addColorStop(0.6, `rgba(147, 51, 234, ${lightBallRef.current.opacity * 0.3})`);
      gradient.addColorStop(1, 'rgba(147, 51, 234, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sourceX, sourceY, lightBallRef.current.size * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 阶段二：光迹飞行
    if (phase === 'flying') {
      const flyingElapsed = elapsed - DURATIONS.gathering;
      const progress = flyingElapsed / DURATIONS.flying;
      const eased = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2; // ease-in-out

      // 计算贝塞尔曲线控制点（向上偏移创造抛物线效果）
      const controlX = (sourceX + targetX) / 2;
      const controlY = Math.min(sourceY, targetY) - 100;

      const pos = calculateBezierPoint(eased, 
        { x: sourceX, y: sourceY },
        { x: controlX, y: controlY },
        { x: targetX, y: targetY }
      );

      // 计算速度用于拖尾
      const prevPos = calculateBezierPoint(Math.max(0, eased - 0.02),
        { x: sourceX, y: sourceY },
        { x: controlX, y: controlY },
        { x: targetX, y: targetY }
      );
      const speed = Math.sqrt(
        Math.pow(pos.x - prevPos.x, 2) + Math.pow(pos.y - prevPos.y, 2)
      );

      // 生成拖尾粒子
      createTrailParticles(pos.x, pos.y, speed);

      lightBallRef.current = {
        x: pos.x,
        y: pos.y,
        size: 20,
        opacity: 1,
      };

      // 绘制光球
      const gradient = ctx.createRadialGradient(
        pos.x, pos.y, 0,
        pos.x, pos.y, 40
      );
      gradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
      gradient.addColorStop(0.2, 'rgba(255, 200, 100, 0.8)');
      gradient.addColorStop(0.5, 'rgba(147, 51, 234, 0.4)');
      gradient.addColorStop(1, 'rgba(147, 51, 234, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 40, 0, Math.PI * 2);
      ctx.fill();
    }

    // 阶段三：落地凝结
    if (phase === 'condensing') {
      const condensingElapsed = elapsed - DURATIONS.gathering - DURATIONS.flying;
      const progress = condensingElapsed / DURATIONS.condensing;
      
      // 光晕扩散
      const haloSize = 40 + progress * 60;
      const haloOpacity = 1 - progress;

      const gradient = ctx.createRadialGradient(
        targetX, targetY, 0,
        targetX, targetY, haloSize
      );
      gradient.addColorStop(0, `rgba(255, 255, 200, ${haloOpacity})`);
      gradient.addColorStop(0.3, `rgba(255, 200, 100, ${haloOpacity * 0.5})`);
      gradient.addColorStop(0.6, `rgba(147, 51, 234, ${haloOpacity * 0.2})`);
      gradient.addColorStop(1, 'rgba(147, 51, 234, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(targetX, targetY, haloSize, 0, Math.PI * 2);
      ctx.fill();

      // Emoji弹性弹出（由父组件处理显示，这里只绘制光晕）
    }

    // 更新和绘制粒子
    if (!isLowEndDevice) {
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.opacity = p.life / p.maxLife;

        if (p.life <= 0) return false;

        ctx.fillStyle = `rgba(255, 200, 100, ${p.opacity * 0.6})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();

        return true;
      });
    }

    // 继续动画
    animationRef.current = requestAnimationFrame(() => render(ctx, canvas));
  }, [sourceRect, targetRect, calculateBezierPoint, createTrailParticles, isLowEndDevice, onComplete, onPhaseChange]);

  // 启动动画
  useEffect(() => {
    if (!isActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布尺寸为全屏
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // 重置状态
    startTimeRef.current = Date.now();
    phaseRef.current = 'gathering';
    particlesRef.current = [];

    // 开始渲染
    render(ctx, canvas);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, render]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[100]"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
};

export default StardustAnimation;
