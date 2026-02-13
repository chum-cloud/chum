import { Routes, Route } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import MintPage from './pages/MintPage';
import SwipePage from './pages/SwipePage';
import AuctionPage from './pages/AuctionPage';
import DocsPage from './pages/DocsPage';
import ArtDetailPage from './pages/ArtDetailPage';

export default function App() {
  return (
    <div className="min-h-screen bg-chum-bg text-chum-text">
      <Routes>
        <Route path="/" element={<MintPage />} />
        <Route path="/judge" element={<SwipePage />} />
        <Route path="/auction" element={<AuctionPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/art/:mint" element={<ArtDetailPage />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
