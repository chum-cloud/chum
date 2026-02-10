import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WalletProvider from './components/WalletProvider';
import App from './App';
import VillainsPage from './components/VillainsPage';
import ExplorePage from './pages/ExplorePage';
import AgentPage from './pages/AgentPage';
import TradesPage from './pages/TradesPage';
import LeaderboardPage from './pages/LeaderboardPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/agent/:wallet" element={<AgentPage />} />
          <Route path="/trades" element={<TradesPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/villains" element={<VillainsPage />} />
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  </StrictMode>,
);
