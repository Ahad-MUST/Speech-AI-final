// src/Components/layout/Sidebar.jsx - Portal-Based Tooltip Solution
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Home, BarChart3, Brain, Settings, Shield } from 'lucide-react';

const navigationItems = [
  { 
    id: 'home', 
    label: 'Home', 
    path: '/', 
    icon: Home,
    description: 'Audio Upload & Configuration'
  },
  { 
    id: 'results', 
    label: 'Results', 
    path: '/results', 
    icon: BarChart3,
    description: 'Processing Status & Results'
  },
  { 
    id: 'analysis', 
    label: 'Analysis', 
    path: '/analysis', 
    icon: Brain,
    description: 'AI Analysis & Insights'
  },
  { 
    id: 'admin', 
    label: 'Admin', 
    path: '/admin', 
    icon: Shield,
    description: 'Prompt Management & Settings'
  }
];

// Portal Tooltip Component
const PortalTooltip = ({ isVisible, position, item }) => {
  if (!isVisible || !position) return null;

  return createPortal(
    <div
      className="fixed px-3 py-3 bg-white text-gray-800 text-sm rounded-xl transition-opacity duration-300 whitespace-nowrap pointer-events-none shadow-xl border border-gray-200"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 999999, // Extremely high z-index
        opacity: isVisible ? 1 : 0,
      }}
    >
      <div className="font-semibold text-gray-900">{item.label}</div>
      <div className="text-xs text-gray-400 mt-1">{item.description}</div>
      {/* Arrow */}
      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-full">
        <div className="w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-white"></div>
      </div>
    </div>,
    document.body
  );
};

// Desktop Navigation Item Component
const NavItem = ({ item, isMobile = false, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === item.path;
  const IconComponent = item.icon;
  
  // Tooltip state
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(null);

  const handleMouseEnter = (e) => {
    if (isMobile) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.right + 12,
      y: rect.top + (rect.height / 2) - 40
    });
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
    setTooltipPosition(null);
  };

  if (isMobile) {
    return (
      <Link
        to={item.path}
        onClick={onClick}
        className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
          isActive 
            ? 'bg-gradient-to-r from-psycon-mint to-psycon-purple text-white shadow-lg' 
            : 'text-gray-700 hover:bg-psycon-light-teal/20 hover:text-psycon-mint'
        }`}
      >
        <IconComponent className="w-5 h-5" />
        <div className="flex-1">
          <span className="font-medium">{item.label}</span>
          <div className={`text-xs opacity-80 ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
            {item.description}
          </div>
        </div>
        {isActive && (
          <div className="w-2 h-2 bg-white rounded-full"></div>
        )}
      </Link>
    );
  }

  return (
    <>
      <Link
        to={item.path}
        className={`flex items-center justify-center p-3 rounded-xl transition-all duration-300 group relative ${
          isActive 
            ? 'bg-gradient-to-r from-psycon-yellow-200 to-psycon-purple text-white shadow-md transform scale-105' 
            : 'text-gray-600 hover:bg-psycon-light-teal/20 hover:text-psycon-mint hover:scale-105'
        }`}
        title={item.label}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <IconComponent className="w-6 h-6" />


      </Link>

      {/* Portal Tooltip */}
      <PortalTooltip 
        isVisible={showTooltip}
        position={tooltipPosition}
        item={item}
      />
    </>
  );
};

// Desktop Sidebar Component
export function Sidebar() {
  return (
    <aside className="bg-psycon-mint-300 border-r border-gray-200 flex flex-col h-full py-5 shadow-sm backdrop-blur-sm">
      {/* Sidebar Navigation */}
      <nav className="flex-1 px-2 pt-6">
        <div className="space-y-5">
          {navigationItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <NavItem item={item} />
            </motion.div>
          ))}
        </div>
      </nav>

      {/* Status Indicator */}
      <div className="px-3 mt-auto">
        <div className="bg-gradient-to-r from-psycon-mint/10 to-psycon-purple/10 rounded-lg p-2 border border-psycon-mint/20">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-gradient-to-r from-psycon-mint to-psycon-purple rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-gray-600">System Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

// Enhanced Hamburger Menu Component (unchanged from previous version)
export function HamburgerMenu({ className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close menu on escape key and handle body scroll
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative z-50 p-2 rounded-lg bg-white border border-gray-200 shadow-sm hover:bg-psycon-light-teal/10 transition-colors focus:outline-none focus:ring-2 focus:ring-psycon-mint ${className}`}
        aria-label="Toggle navigation menu"
        type="button"
      >
        <motion.div
          className="w-5 h-0.5 bg-gray-700 rounded-full"
          animate={{
            rotate: isOpen ? 45 : 0,
            y: isOpen ? 4 : 0,
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        />
        <motion.div
          className="w-5 h-0.5 bg-gray-700 rounded-full mt-1"
          animate={{
            opacity: isOpen ? 0 : 1,
            x: isOpen ? -10 : 0,
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        />
        <motion.div
          className="w-5 h-0.5 bg-gray-700 rounded-full mt-1"
          animate={{
            rotate: isOpen ? -45 : 0,
            y: isOpen ? -4 : 0,
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        />
      </button>
      
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" 
            onClick={handleBackdropClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>
      
      {/* Slide-out Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="fixed top-0 left-0 h-full w-80 bg-gradient-to-b from-white via-psycon-light-teal/5 to-psycon-lavender/5 z-50 shadow-2xl backdrop-blur-sm border-r border-gray-200"
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ 
              type: "spring", 
              damping: 20, 
              stiffness: 300,
              duration: 0.3 
            }}
          >
            {/* Menu Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-psycon-mint/5 to-psycon-purple/5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-psycon-mint to-psycon-purple rounded-xl flex items-center justify-center shadow-md">
                  <img 
                    src="/Logo.png" 
                    alt="PsyConTech" 
                    className="h-5 w-auto filter brightness-0 invert"
                  />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
                  <p className="text-xs text-gray-500">Navigate your workspace</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 px-6 py-4 overflow-y-auto">
              <div className="space-y-2">
                {navigationItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (index * 0.1) + 0.2 }}
                  >
                    <NavItem item={item} isMobile={true} onClick={handleLinkClick} />
                  </motion.div>
                ))}
              </div>
            </nav>

            {/* Mobile Footer */}
            <div className="p-6 border-t border-gray-200 bg-gradient-to-r from-psycon-mint/5 to-psycon-purple/5">
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-gradient-to-r from-psycon-mint to-psycon-purple rounded-full animate-pulse"></div>
                <span>System Online</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}