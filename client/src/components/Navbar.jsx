import { useTheme } from '../context/ThemeContext';
import { HiMenu, HiSun, HiMoon, HiBell, HiSearch } from 'react-icons/hi';
import { motion } from 'framer-motion';

export default function Navbar({ onMenuToggle }) {
  return (
    <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-dark-200/20">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-xl hover:bg-dark-100 transition-colors"
          >
            <HiMenu className="w-6 h-6 text-dark-600" />
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-enviro-500/20 cursor-pointer">
            EC
          </div>
        </div>
      </div>
    </header>
  );
}
