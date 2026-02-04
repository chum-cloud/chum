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
    <div>
      <h2 className="text-xl font-bold font-heading mb-4">Services</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SERVICES.map((service) => (
          <div
            key={service.name}
            className="rounded-lg border border-chum-border bg-chum-surface p-4 opacity-60 cursor-not-allowed relative"
          >
            <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider text-chum-muted bg-chum-bg px-2 py-0.5 rounded">
              Coming Soon
            </div>
            <div className="text-2xl mb-2">{service.icon}</div>
            <div className="font-semibold text-sm mb-1">{service.name}</div>
            <div className="text-xs text-chum-muted mb-2">{service.description}</div>
            <div className="text-xs font-mono text-chum-accent">{service.price} SOL</div>
          </div>
        ))}
      </div>
    </div>
  );
}
