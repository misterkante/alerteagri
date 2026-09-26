import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Alerts, Harvest, Home, Login, Pesticide, ProducerHome, Report, Sheets, Sowing } from './pages/farmer';
import { LotPage, Market, ReceiptCheck, UssdPhone } from './pages/market';
import { Cms, Commune, Dashboard } from './pages/staff';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/connexion" element={<Login />} />
        <Route path="/producteur" element={<ProducerHome />} />
        <Route path="/semis" element={<Sowing />} />
        <Route path="/signaler" element={<Report />} />
        <Route path="/recolte" element={<Harvest />} />
        <Route path="/pesticide" element={<Pesticide />} />
        <Route path="/fiches" element={<Sheets />} />
        <Route path="/alertes" element={<Alerts />} />
        <Route path="/marche" element={<Market />} />
        <Route path="/telephone" element={<UssdPhone />} />
        <Route path="/recu/:id" element={<ReceiptCheck />} />
        <Route path="/lot/:code" element={<LotPage />} />
        <Route path="/tableau" element={<Dashboard />} />
        <Route path="/cms" element={<Cms />} />
        <Route path="/recettes" element={<Commune />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
