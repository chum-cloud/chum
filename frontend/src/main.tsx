import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WalletProvider from './components/WalletProvider';
import App from './App';
import CloudPage from './pages/CloudPage';
import ClaimPage from './pages/ClaimPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/cloud" element={<CloudPage />} />
          <Route path="/cloud/claim/:token" element={<ClaimPage />} />
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  </StrictMode>,
);
