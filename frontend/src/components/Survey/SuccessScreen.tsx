import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button, Card } from "@/components/okaform";

export function SuccessScreen({
  scoreDelta,
  newScore,
}: {
  scoreDelta: number;
  newScore: number;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center gap-8 py-12 text-center">
      {/* Sentinel particle burst */}
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-ok-green/30 bg-ok-green/10">
          <CheckCircle2 className="h-10 w-10 text-ok-green" />
        </div>
        {/* Static particle dots */}
        {[
          { x: -32, y: -24, delay: "0ms" },
          { x: 28, y: -30, delay: "100ms" },
          { x: -40, y: 16, delay: "200ms" },
          { x: 36, y: 20, delay: "150ms" },
          { x: -16, y: -40, delay: "50ms" },
          { x: 20, y: -38, delay: "250ms" },
          { x: -36, y: -8, delay: "120ms" },
          { x: 40, y: 4, delay: "180ms" },
        ].map((dot, i) => (
          <span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-ok-green animate-ping"
            style={{
              left: `calc(50% + ${dot.x}px)`,
              top: `calc(50% + ${dot.y}px)`,
              animationDelay: dot.delay,
              animationDuration: "1.5s",
            }}
          />
        ))}
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
        onClick={() => navigate('/')}>
        Back to Explore
      </Button>
    </div>
  );
}
