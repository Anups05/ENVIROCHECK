import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Results from './pages/Results';
import CityCompare from './pages/CityCompare';
import Simulator from './pages/Simulator';
import Predictions from './pages/Predictions';
import Reports from './pages/Reports';

import AqiDetails from './pages/AqiDetails';

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <div className="min-h-screen gradient-bg-subtle">
      {!isHomePage && (
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}
      <div className={`${!isHomePage ? 'lg:ml-[280px]' : ''} min-h-screen flex flex-col`}>
        {!isHomePage && (
          <Navbar onMenuToggle={() => setSidebarOpen(prev => !prev)} />
        )}
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/results" element={<Results />} />
            <Route path="/aqi-details" element={<AqiDetails />} />
            <Route path="/compare" element={<CityCompare />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppLayout />
      </Router>
    </ThemeProvider>
  );
}
