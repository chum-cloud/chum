import { Routes, Route } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import { VoteBalanceProvider } from './lib/VoteBalanceContext';
import MintPage from './pages/MintPage';
import VotePage from './pages/VotePage';
import SwipePage from './pages/SwipePage';
import AuctionPage from './pages/AuctionPage';
import DocsPage from './pages/DocsPage';
import ArtDetailPage from './pages/ArtDetailPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <VoteBalanceProvider>
    <div className="min-h-screen bg-chum-bg text-chum-text">
      <Routes>
        <Route path="/" element={<MintPage />} />
        <Route path="/vote" element={<VotePage />} />
        <Route path="/judge" element={<SwipePage />} />
        <Route path="/auction" element={<AuctionPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/art/:mint" element={<ArtDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:wallet" element={<ProfilePage />} />
      </Routes>
      <BottomNav />
    </div>
    </VoteBalanceProvider>
  );
}
