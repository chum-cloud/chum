import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Mint', icon: '◆' },
  { to: '/judge', label: 'Judge', icon: '⚡' },
  { to: '/auction', label: 'Auction', icon: '◉' },
  { to: '/docs', label: 'Docs', icon: '☰' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-chum-border bg-chum-bg/95 backdrop-blur-sm">
      <div className="max-w-[480px] mx-auto flex h-[56px]">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-mono transition-colors ${
                isActive ? 'text-chum-text' : 'text-chum-muted'
              }`
            }
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            <span className="uppercase tracking-wider text-[10px]">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
