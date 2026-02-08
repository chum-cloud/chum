import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WalletProvider from './components/WalletProvider';
import App from './App';
import CloudPage from './pages/CloudPage';
import ClaimPage from './pages/ClaimPage';
import AgentProfilePage from './pages/AgentProfilePage';
import WarRoom from './pages/WarRoom';
import VillainsPage from './components/VillainsPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/cloud" element={<CloudPage />} />
          <Route path="/cloud/agent/:name" element={<AgentProfilePage />} />
          <Route path="/cloud/claim/:token" element={<ClaimPage />} />
          <Route path="/villains" element={<VillainsPage />} />
          <Route path="/war-room" element={<WarRoom />} />
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  </StrictMode>,
);
