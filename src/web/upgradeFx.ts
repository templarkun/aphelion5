/**
 * Particle effects of the Upgrade sheet (designer 2026-11-09, step 4): one canvas over the whole
 * sheet, drawn only while something is moving. Sparks when a slot fills; a shockwave, light rays
 * and a big burst when an upgrade fills up. Screen only, nothing here changes the game.
 * With reduced motion nothing is drawn.
 */

type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; colour: string; drag: number; glow: boolean };
type Ring = { x: number; y: number; r: number; speed: number; life: number; max: number; colour: string; width: number };
type Rays = { x: number; y: number; life: number; max: number; colour: string; n: number; spin: number; len: number };

const still = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export class UpgradeFx {
  private ctx: CanvasRenderingContext2D | null;
  private parts: P[] = [];
  private rings: Ring[] = [];
  private rays: Rays[] = [];
  private raf = 0;
  private last = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d");
  }

  /** Canvas pixels follow its size on screen (called before each burst). */
  private fit(): DOMRect {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    return r;
  }

  private local(x: number, y: number): [number, number] {
    const r = this.fit();
    return [x - r.left, y - r.top];
  }

  /** A slot fills: a small spray of sparks and a quick ring (screen coordinates). */
  spark(sx: number, sy: number, colour: string): void {
    if (still()) return;
    const [x, y] = this.local(sx, sy);
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 190;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0, max: 0.35 + Math.random() * 0.4, size: 1 + Math.random() * 2, colour: Math.random() < 0.3 ? "#ffffff" : colour, drag: 3.2, glow: true });
    }
    this.rings.push({ x, y, r: 4, speed: 120, life: 0, max: 0.35, colour, width: 2 });
    this.start();
  }

  /** An upgrade fills up: shockwaves, turning light rays and a big burst of embers. */
  burst(sx: number, sy: number, colour: string, big = true): void {
    if (still()) return;
    const [x, y] = this.local(sx, sy);
    const n = big ? 110 : 60;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 90 + Math.random() * (big ? 420 : 260);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.6 + Math.random() * 0.9, size: 1.2 + Math.random() * 2.8, colour: Math.random() < 0.35 ? "#ffffff" : colour, drag: 2.1, glow: true });
    }
    // Slow embers that rise.
    for (let i = 0; i < (big ? 40 : 18); i++) {
      this.parts.push({ x: x + (Math.random() - 0.5) * 160, y: y + (Math.random() - 0.5) * 40, vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 70, life: 0, max: 1.2 + Math.random() * 1.2, size: 1 + Math.random() * 1.6, colour, drag: 0.4, glow: true });
    }
    this.rings.push({ x, y, r: 10, speed: big ? 520 : 360, life: 0, max: 0.75, colour: "#ffffff", width: 4 });
    this.rings.push({ x, y, r: 6, speed: big ? 300 : 220, life: 0, max: 1.0, colour, width: 6 });
    if (big) this.rings.push({ x, y, r: 2, speed: 160, life: 0, max: 1.3, colour, width: 2 });
    this.rays.push({ x, y, life: 0, max: big ? 1.6 : 1.1, colour, n: big ? 14 : 9, spin: (Math.random() < 0.5 ? -1 : 1) * 0.6, len: big ? 260 : 150 });
    this.start();
  }

  private start(): void {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (now: number): void => {
    // The first frame's time can be a little before start(): never step backwards.
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    const g = this.ctx;
    if (!g) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    g.restore();
    g.globalCompositeOperation = "lighter";
    // Light rays.
    this.rays = this.rays.filter((r) => (r.life += dt) < r.max);
    for (const r of this.rays) {
      const k = r.life / r.max;
      const a = Math.sin(Math.PI * Math.min(1, k * 1.4)) * 0.5;
      for (let i = 0; i < r.n; i++) {
        const ang = (i / r.n) * Math.PI * 2 + r.life * r.spin;
        const len = r.len * (0.6 + 0.4 * ((i * 37) % 10) / 10) * (0.5 + k);
        const grad = g.createLinearGradient(r.x, r.y, r.x + Math.cos(ang) * len, r.y + Math.sin(ang) * len);
        grad.addColorStop(0, withAlpha(r.colour, a));
        grad.addColorStop(1, withAlpha(r.colour, 0));
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(r.x, r.y);
        g.lineTo(r.x + Math.cos(ang - 0.05) * len, r.y + Math.sin(ang - 0.05) * len);
        g.lineTo(r.x + Math.cos(ang + 0.05) * len, r.y + Math.sin(ang + 0.05) * len);
        g.closePath();
        g.fill();
      }
    }
    // Shockwaves.
    this.rings = this.rings.filter((r) => (r.life += dt) < r.max);
    for (const r of this.rings) {
      const k = r.life / r.max;
      g.strokeStyle = withAlpha(r.colour, (1 - k) * 0.85);
      g.lineWidth = r.width * (1 - k * 0.7);
      g.beginPath();
      g.arc(r.x, r.y, Math.max(0, r.r + r.speed * r.life * (1 - k * 0.35)), 0, Math.PI * 2);
      g.stroke();
    }
    // Sparks and embers.
    this.parts = this.parts.filter((p) => (p.life += dt) < p.max);
    for (const p of this.parts) {
      const f = Math.exp(-p.drag * dt);
      p.vx *= f;
      p.vy *= f;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = 1 - p.life / p.max;
      if (p.glow) {
        g.fillStyle = withAlpha(p.colour, k * 0.25);
        g.beginPath();
        g.arc(p.x, p.y, Math.max(0, p.size * 3), 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = withAlpha(p.colour, k);
      g.beginPath();
      g.arc(p.x, p.y, Math.max(0, p.size * (0.5 + 0.5 * k)), 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
    if (this.parts.length || this.rings.length || this.rays.length) this.raf = requestAnimationFrame(this.tick);
    else this.raf = 0;
  };
}

/** "#rrggbb" with an alpha. */
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
