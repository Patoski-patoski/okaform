import SolanaLogo from "@/components/SolanaLogo";
import UsdcLogo from "@/components/UsdcLogo";

export interface CurrencyLogoProps {
  currency?: string | null;
  className?: string;
}

export default function CurrencyLogo({
  currency,
  className,
}: CurrencyLogoProps) {
  if (currency === "USDC") {
    return <UsdcLogo className={className} />;
  }
  return <SolanaLogo className={className} />;
}
