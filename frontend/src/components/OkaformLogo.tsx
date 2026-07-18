import fullLogo from "@/assets/images/okaform-logo.svg";
import iconLogo from "@/assets/images/okaform-icon.svg";

interface OkaformLogoProps {
  variant?: 'horizontal' | 'icon' | 'stacked' | 'wordmark';
  theme?: 'dark' | 'light';
  height?: number;
  className?: string;
}

const COLORS = {
  dark: {
    bg:      '#0D1F1A',
    text:    '#F0FDF4',
    accent:  '#14F195',
    muted:   '#6EE7B7',
  },
  light: {
    bg:      '#F0FDF4',
    text:    '#0D1F1A',
    accent:  '#059669',
    muted:   '#065f46',
  },
} as const;

function WordmarkLogo({
  colors,
  height,
  className,
}: {
  colors: { bg: string; text: string; accent: string; muted: string };
  height: number;
  className?: string;
}) {
  const fontSize = Math.round(height * 0.9);
  const width = fontSize * 3.8;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      role="img"
      aria-label="Okaform"
      className={className}
    >
      <title>Okaform</title>
      <text
        x={0}
        y={height * 0.8}
        fontFamily="'Space Grotesk', 'Segoe UI', system-ui, sans-serif"
        fontSize={fontSize}
        fontWeight={700}
        letterSpacing="-0.02em"
      >
        <tspan fill={colors.text}>Oka</tspan>
        <tspan fill={colors.accent}>form</tspan>
      </text>
    </svg>
  );
}

function StackedLogo({
  height,
  className,
}: {
  height: number;
  className?: string;
}) {
  return (
    <img
      src={fullLogo}
      alt="Okaform"
      height={height}
      className={className}
      style={{ width: 'auto', height }}
    />
  );
}

export default function OkaformLogo({
  variant = 'horizontal',
  theme = 'dark',
  height = 36,
  className,
}: OkaformLogoProps) {
  const colors = COLORS[theme];

  switch (variant) {
    case 'icon':
      return (
        <img
          src={iconLogo}
          alt="Okaform"
          height={height}
          className={className}
          style={{ width: 'auto', height }}
        />
      );
    case 'stacked':
      return <StackedLogo height={height} className={className} />;
    case 'wordmark':
      return <WordmarkLogo colors={colors} height={height} className={className} />;
    case 'horizontal':
    default:
      return (
        <img
          src={fullLogo}
          alt="Okaform"
          height={height}
          className={className}
          style={{ width: 'auto', height }}
        />
      );
  }
}
