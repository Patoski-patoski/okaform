import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button, Card } from "@/components/okaform";

interface Particle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  shape: "square" | "circle" | "strip";
  delay: number;
  duration: number;
  drift: number;
}

const CONFETTI_COLORS = [
  "#14F195", // ok-green
  "#A371F7", // ok-purple
  "#58A6FF", // blue
  "#E3B341", // gold
  "#F78166", // orange
  "#79C0FF", // light blue
  "#D2A8FF", // light purple
  "#7EE787", // light green
];

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 300,
    y: -(Math.random() * 400 + 100),
    rotation: Math.random() * 720 - 360,
    scale: Math.random() * 0.5 + 0.5,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    shape: (["square", "circle", "strip"] as const)[Math.floor(Math.random() * 3)],
    delay: Math.random() * 300,
    duration: Math.random() * 1000 + 1500,
    drift: (Math.random() - 0.5) * 200,
  }));
}

function ConfettiParticle({ particle }: { particle: Particle }) {
  const shapeClasses = {
    square: "w-2 h-2 rounded-[1px]",
    circle: "w-2 h-2 rounded-full",
    strip: "w-1 h-3 rounded-full",
  };

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: "50%",
        top: "50%",
        animation: `confetti-fall ${particle.duration}ms ease-out ${particle.delay}ms forwards`,
        "--drift": `${particle.drift}px`,
        "--rotation": `${particle.rotation}deg`,
      } as React.CSSProperties}
    >
      <div
        className={shapeClasses[particle.shape]}
        style={{
          backgroundColor: particle.color,
          transform: `scale(${particle.scale})`,
        }}
      />
    </div>
  );
}

export function SuccessScreen({
  scoreDelta,
  newScore,
}: {
  scoreDelta: number;
  newScore: number;
}) {
  const navigate = useNavigate();
  const [particles] = useState(() => createParticles(40));
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center gap-8 py-12 text-center">
      {/* Confetti container */}
      {showConfetti && (
        <div className="relative h-0 w-0">
          {particles.map((p) => (
            <ConfettiParticle key={p.id} particle={p} />
          ))}
        </div>
      )}

      {/* Success icon */}
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-ok-green/30 bg-ok-green/10">
          <CheckCircle2 className="h-10 w-10 text-ok-green" />
        </div>
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-full border border-ok-green/20 animate-ping" />
      </div>

      <div className="space-y-2">
        <h2 className="font-display text-2xl font-bold text-ok-text">
          Response Submitted
        </h2>
        <p className="text-sm text-ok-muted">
          Rewards distribute when the survey closes.
        </p>
      </div>

      <Card padding="md" className="w-full max-w-sm">
        <p className="mb-2 text-xs text-ok-muted">Score Updated</p>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg text-ok-green">
            +{scoreDelta}
          </span>
          <span className="text-sm text-ok-muted">→</span>
          <span className="font-display text-xl font-bold text-ok-text">
            {newScore}
          </span>
          <span className="text-xs text-ok-muted">total</span>
        </div>
      </Card>
      <Button
        variant="secondary"
        size="md"
        onClick={() => navigate('/explore')}>
        Back to Explore
      </Button>
    </div>
  );
}
