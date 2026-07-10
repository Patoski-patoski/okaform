import {
  Badge,
  Button,
  Card,
  Navbar,
  SOLAmount,
  StatusPill,
  WalletButton,
  type BadgeTier,
} from "../components/okaform"

const TIERS: BadgeTier[] = ["grey", "blue", "green", "gold", "diamond"]

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold text-ok-text">{title}</h2>
        <p className="font-sans text-sm text-ok-muted">{description}</p>
      </div>
      {children}
    </Card>
  )
}

function Home() {
  return (
    <div className="min-h-screen bg-ok-bg font-sans">
      <Navbar
        wallet={{ address: "7xKpDfGh9Lm2QwErTyU3mQr", tier: "gold" }}
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
        {/* Header */}
        <header className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase tracking-widest text-ok-green">
            Design System
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ok-text text-balance">
            Okaform component library
          </h1>
          <p className="max-w-xl font-sans text-sm leading-relaxed text-ok-muted text-pretty">
            The building blocks for a Web3 survey platform on Solana — creators lock
            SOL rewards in escrow, respondents earn based on their reputation score.
          </p>
        </header>

        {/* Buttons */}
        <Section
          title="Button"
          description="Primary (green fill), secondary (ghost border), and danger — in three sizes."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="sm">
                Primary
              </Button>
              <Button variant="primary" size="md">
                Primary
              </Button>
              <Button variant="primary" size="lg">
                Primary
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm">
                Secondary
              </Button>
              <Button variant="secondary" size="md">
                Secondary
              </Button>
              <Button variant="secondary" size="lg">
                Secondary
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="danger" size="md">
                Delete form
              </Button>
              <Button variant="primary" size="md" disabled>
                Disabled
              </Button>
            </div>
          </div>
        </Section>

        {/* Badges */}
        <Section
          title="Badge"
          description="Five reputation tiers, driven by a respondent's on-chain score."
        >
          <div className="flex flex-wrap items-center gap-3">
            {TIERS.map((tier) => (
              <Badge key={tier} tier={tier} />
            ))}
          </div>
        </Section>

        {/* SOLAmount + StatusPill */}
        <div className="grid gap-6 md:grid-cols-2">
          <Section
            title="SOLAmount"
            description="Monospace SOL values with the ◎ symbol in green."
          >
            <div className="flex flex-col gap-3 font-display text-2xl">
              <SOLAmount amount={12.5} />
              <SOLAmount amount={0.0042} decimals={4} />
              <SOLAmount amount={"1,240.00"} />
            </div>
          </Section>

          <Section
            title="StatusPill"
            description="Lifecycle state of a survey's reward escrow."
          >
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill status="active" />
              <StatusPill status="distributing" />
              <StatusPill status="closed" />
            </div>
          </Section>
        </div>

        {/* Wallet */}
        <Section
          title="WalletButton"
          description="Disconnected connect state and a connected state showing the truncated address with the user's tier."
        >
          <div className="flex flex-wrap items-center gap-3">
            <WalletButton />
            <WalletButton address="7xKpDfGh9Lm2QwErTyU3mQr" tier="diamond" />
            <WalletButton address="9aBcDeF1Gh2iJk3LmN4pQr" tier="blue" />
          </div>
        </Section>

        {/* Card composition example */}
        <Section
          title="Card"
          description="Dark surface with a hairline border — the base of every panel above."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Card padding="md" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-ok-text">
                  Product-market fit survey
                </h3>
                <StatusPill status="active" />
              </div>
              <p className="font-sans text-sm text-ok-muted">
                Reward pool locked in escrow, distributed on completion.
              </p>
              <div className="flex items-center justify-between border-t border-ok-border pt-3">
                <span className="font-mono text-xs text-ok-muted">Reward pool</span>
                <SOLAmount amount={48.0} className="text-base" />
              </div>
            </Card>
            <Card padding="md" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-ok-text">
                  Beta feedback round
                </h3>
                <StatusPill status="distributing" />
              </div>
              <p className="font-sans text-sm text-ok-muted">
                Min. reputation tier required to participate.
              </p>
              <div className="flex items-center justify-between border-t border-ok-border pt-3">
                <span className="font-mono text-xs text-ok-muted">Min. tier</span>
                <Badge tier="green" />
              </div>
            </Card>
          </div>
        </Section>
      </main>
    </div>
  )
}

export default Home
