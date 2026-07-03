import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HiHome, HiChartBar, HiDocumentReport, HiScale, 
  HiAdjustments, HiTrendingUp, HiDocumentText, HiX,
  HiBeaker
} from 'react-icons/hi';

const navItems = [
  { path: '/', icon: HiHome, label: 'Home' },
  { path: '/dashboard', icon: HiChartBar, label: 'Dashboard' },
  { path: '/compare', icon: HiScale, label: 'City Compare' },
  { path: '/simulator', icon: HiAdjustments, label: 'What-If' },
  { path: '/predictions', icon: HiTrendingUp, label: 'Predictions' },
  { path: '/reports', icon: HiDocumentText, label: 'Reports' },
];

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-[280px] z-50
        bg-white/80 backdrop-blur-2xl
        border-r border-dark-200/30
        transform transition-transform duration-300 ease-out
        lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shadow-lg shadow-enviro-500/25">
              <HiBeaker className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-dark-900 leading-tight">
                EnviroCheck
              </h1>
              <p className="text-xs text-dark-500 font-medium">
                Environmental AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-dark-100 transition-colors"
          >
            <HiX className="w-5 h-5 text-dark-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1.5 mt-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={isActive ? 'sidebar-link-active' : 'sidebar-link'}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-enviro-500' : ''}`} />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="ml-auto w-2 h-2 rounded-full bg-enviro-500"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-dark-500 dark:text-dark-400">
              Powered by AI
            </p>
            <p className="text-xs font-semibold gradient-text mt-1">
              v1.0.0 – EnviroCheck
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
