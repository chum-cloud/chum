import { Routes, Route } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import MintPage from './pages/MintPage';
import VotePage from './pages/VotePage';
import AuctionPage from './pages/AuctionPage';
import VillainsPage from './components/VillainsPage';

export default function App() {
  return (
    <div className="min-h-screen bg-chum-bg text-chum-text">
      <Routes>
        <Route path="/" element={<MintPage />} />
        <Route path="/vote" element={<VotePage />} />
        <Route path="/auction" element={<AuctionPage />} />
        <Route path="/villains" element={<VillainsPage />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
