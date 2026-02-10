import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WalletProvider from './components/WalletProvider';
import App from './App';
import VillainsPage from './components/VillainsPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/villains" element={<VillainsPage />} />
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  </StrictMode>,
);
