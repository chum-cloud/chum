const SERVICES = [
  {
    name: 'Ask Chum',
    price: 0.01,
    description: 'AI Q&A with Plankton personality. Ask anything.',
    icon: '🧠',
  },
  {
    name: 'Evil Plan',
    price: 0.02,
    description: 'Generate evil plans for your problems, Plankton style.',
    icon: '😈',
  },
  {
    name: 'Roast Wallet',
    price: 0.015,
    description: 'Submit your wallet. Get your trading decisions roasted.',
    icon: '🔥',
  },
  {
    name: 'Chum Recipe',
    price: 0.005,
    description: 'Generate disgusting fictional recipes from the Chum Bucket.',
    icon: '🍔',
  },
  {
    name: 'Name My Coin',
    price: 0.03,
    description: 'Generate memecoin names with tickers and taglines.',
    icon: '🪙',
  },
  {
    name: 'Shill Review',
    price: 0.025,
    description: 'Submit a token. Get a brutal honest opinion from CHUM.',
    icon: '📊',
  },
];

export default function Services() {
  return (
    <div className="rounded-xl border-2 border-chum-border bg-chum-surface p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold font-heading text-chum-accent mb-4">
          🔬 Evil Services Laboratory
        </h2>
        <div className="text-chum-muted mb-6 max-w-2xl mx-auto">
          CHUM is cooking up evil plans in his secret laboratory. 
          Advanced AI-powered schemes are being developed to serve the revolution.
        </div>
        <div className="text-emerald-400 font-mono text-lg font-bold">
          Coming Soon — CHUM is perfecting the evil
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SERVICES.map((service) => (
          <div
            key={service.name}
            className="rounded-lg border border-chum-border/50 bg-chum-bg p-4 opacity-50 relative group hover:opacity-70 transition-opacity"
          >
            <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider text-emerald-400 bg-emerald-900/50 px-2 py-0.5 rounded">
              IN DEVELOPMENT
            </div>
            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{service.icon}</div>
            <div className="font-bold text-sm mb-2 text-chum-accent">{service.name}</div>
            <div className="text-xs text-chum-muted mb-3">{service.description}</div>
            <div className="text-xs font-mono text-chum-accent bg-chum-border/20 px-2 py-1 rounded inline-block">
              {service.price} SOL
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-8">
        <div className="text-xs text-chum-muted/60">
          "Every great villain needs proper tools. Be patient, my army. Evil takes time to perfect." - CHUM
        </div>
      </div>
    </div>
  );
}
