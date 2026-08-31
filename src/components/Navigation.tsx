// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search, Home, Film, Tv, PlaySquare, User, LogIn, LogOut, Bell, ShieldAlert, Sparkles, Clapperboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });
  
  const [userEmail, setUserEmail] = useState(() => {
    return localStorage.getItem('userEmail') || '';
  });

  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('userRole') || 'user';
  });

  const location = useLocation();
  const navigate = useNavigate();

  const notifications = [
    { id: 1, title: '4K Ultra HD Release', body: 'Dune: Part Two (4K Ultra HD) is now streaming in Dolby Atmos.', time: '2m ago' },
    { id: 2, title: 'Trending Series', body: 'Stranger Things Season 5 teaser & episodes updated.', time: '1h ago' },
    { id: 3, title: 'Watchlist Recommendation', body: 'Demon Slayer: Hashira Training Arc available in Dual Audio.', time: '1d ago' }
  ];

  const mainNavLinks = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Movies', path: '/search?type=movie', icon: Film },
    { name: 'TV Series', path: '/search?type=tv', icon: Tv },
    { name: 'Anime', path: '/search?type=anime', icon: PlaySquare },
  ];

  const links = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Search Catalog', path: '/search', icon: Search },
    { name: 'My Profile & Watchlist', path: '/profile', icon: User },
  ];

  const isAdmin = isLoggedIn && (userEmail.trim().toLowerCase() === 'mdido406@gmail.com' || userRole === 'admin');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      const emailLower = emailInput.trim().toLowerCase();
      try {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userEmail', emailLower);
      } catch (err) {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('swr_') || k.startsWith('resolved_ids_') || k.includes('home_section_data_') || k.includes('api_home_data'))) {
              localStorage.removeItem(k);
              i--;
            }
          }
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userEmail', emailLower);
        } catch (_) {}
      }
      
      let role = 'user';
      if (emailLower === 'mdido406@gmail.com' && (passwordInput === 'mdsaimon121' || passwordInput === 'mdsainon121')) {
        role = 'admin';
      }
      
      try {
        localStorage.setItem('userRole', role);
      } catch (_) {}
      setIsLoggedIn(true);
      setUserEmail(emailInput);
      setUserRole(role);
      setShowLoginModal(false);
      setEmailInput('');
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    setIsLoggedIn(false);
    setUserEmail('');
    setUserRole('user');
    setIsOpen(false);
    navigate('/home');
  };

  useEffect(() => {
    setShowNotifications(false);
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isOpen]);

  if (location.pathname === '/' || location.pathname === '/watch-video') {
    return null;
  }

  return (
    <>
      {/* Moonlight Glass Navigation Bar */}
      <nav className="fixed top-0 left-0 w-full z-[70] bg-[#060a14]/90 backdrop-blur-xl border-b border-blue-500/20 shadow-[0_4px_30px_rgba(0,102,255,0.25)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* LEFT: AnOvA Brand Logo + Navigation Links */}
          <div className="flex items-center gap-10">
            <Link to="/home" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-[#00d2ff] p-[1.5px] shadow-[0_0_20px_rgba(0,210,255,0.4)] group-hover:scale-105 group-hover:shadow-[0_0_25px_rgba(0,210,255,0.6)] transition-all duration-300">
                <div className="w-full h-full bg-[#060a14] rounded-[10px] flex items-center justify-center">
                  <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-[#00d2ff] text-xl select-none leading-none">
                    A
                  </span>
                </div>
              </div>
              <span className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center">
                AnOvA<span className="text-[#00d2ff] animate-pulse">.</span>
              </span>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden lg:flex items-center gap-8">
              {mainNavLinks.map(link => {
                const isActive = location.pathname === link.path || (link.path.includes('?') && location.search.includes(link.path.split('?')[1]));
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={cn(
                      "text-xs font-medium tracking-wide transition-colors py-2 relative uppercase",
                      isActive
                        ? "text-white font-bold"
                        : "text-zinc-400 hover:text-white"
                    )}
                  >
                    {link.name}
                    {isActive && (
                      <motion.div
                        layoutId="activeNavIndicator"
                        className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#0066ff] via-[#00d2ff] to-[#38bdf8] rounded-full shadow-[0_0_10px_#00d2ff]"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Search, Notifications, User Account, Menu Toggle */}
          <div className="flex items-center gap-3 relative">
            
            {/* Search Button */}
            <Link 
              to="/search" 
              className={cn(
                "p-2.5 text-zinc-300 hover:text-white transition-all rounded-xl bg-[#0d1630]/80 border border-blue-500/20 hover:border-[#00d2ff]/50 hover:shadow-[0_0_15px_rgba(0,210,255,0.3)] active:scale-95",
                location.pathname === '/search' && "text-[#00d2ff] border-[#00d2ff]/60 bg-[#132046]"
              )}
              title="Search Catalog"
            >
              <Search size={18} />
            </Link>

            {/* Notifications Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 text-zinc-300 hover:text-white transition-all rounded-xl bg-[#0d1630]/80 border border-blue-500/20 hover:border-[#00d2ff]/50 hover:shadow-[0_0_15px_rgba(0,210,255,0.3)] active:scale-95 relative cursor-pointer"
                title="Notifications"
              >
                <Bell size={18} />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#00d2ff] shadow-[0_0_8px_#00d2ff]" />
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-3 w-80 bg-[#060a14]/95 border border-blue-500/30 rounded-2xl shadow-2xl p-4 z-50 backdrop-blur-xl"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-blue-500/20 mb-3">
                        <span className="font-semibold text-xs text-white uppercase tracking-wider flex items-center gap-2">
                          <Sparkles size={14} className="text-[#00d2ff]" /> Live Feed
                        </span>
                        <span className="text-[10px] text-[#00d2ff] bg-[#00d2ff]/10 px-2 py-0.5 rounded-full font-medium border border-[#00d2ff]/30">4K Live</span>
                      </div>
                      <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-none pr-1">
                        {notifications.map(item => (
                          <div key={item.id} className="p-3 rounded-xl bg-[#0d1630] border border-blue-500/15 hover:border-[#00d2ff]/40 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-medium text-white leading-snug">{item.title}</p>
                              <span className="text-[9px] text-zinc-400 shrink-0">{item.time}</span>
                            </div>
                            <p className="text-[11px] text-zinc-300 mt-1 leading-relaxed">{item.body}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* User Profile / Login Button */}
            {isLoggedIn ? (
              <Link 
                to="/profile" 
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all active:scale-95 bg-[#0d1630]",
                  location.pathname === '/profile' 
                    ? "border-[#00d2ff]/60 text-white shadow-[0_0_15px_rgba(0,210,255,0.3)]" 
                    : "border-blue-500/20 text-zinc-300 hover:border-blue-500/40 hover:text-white"
                )}
                title="Account Settings"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-[#0066ff] to-[#00d2ff] flex items-center justify-center font-bold text-xs text-white shadow-md">
                  {userEmail.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-xs font-medium max-w-[100px] truncate">{userEmail.split('@')[0]}</span>
              </Link>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl btn-primary text-white text-xs font-semibold tracking-wide transition-all duration-300 active:scale-95 cursor-pointer"
              >
                <LogIn size={14} className="text-white" />
                <span>Sign In</span>
              </button>
            )}

            {/* Telegram Icon */}
            <a 
              href="https://t.me/anovaanime" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2.5 text-zinc-300 hover:text-white transition-all rounded-xl bg-[#0d1630]/80 border border-blue-500/20 hover:border-[#00d2ff]/50 active:scale-95"
              title="Join Telegram Community"
            >
              <svg className="w-4 h-4 fill-current text-[#00d2ff]" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472z"/>
              </svg>
            </a>

            {/* Mobile Hamburger Toggle */}
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="p-2.5 text-zinc-300 hover:text-white transition-colors rounded-xl bg-[#0d1630]/80 border border-blue-500/20 active:scale-95 cursor-pointer lg:hidden"
              title="Navigation Menu"
            >
              {isOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

          </div>
        </div>
      </nav>

      {/* Mobile Drawer Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed top-0 right-0 h-full max-h-screen w-full max-w-sm bg-[#060a14] border-l border-blue-500/20 z-[65] p-6 pt-24 pb-12 flex flex-col justify-between overflow-y-auto scrollbar-none shadow-2xl touch-pan-y"
            >
              <div className="space-y-6">
                {/* Account Profile Header */}
                <div className="border-b border-blue-500/20 pb-6">
                  {isLoggedIn ? (
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-r from-[#0066ff] to-[#00d2ff] flex items-center justify-center font-bold text-lg text-white shadow-lg">
                        {userEmail.charAt(0).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-semibold text-white truncate">{userEmail}</p>
                        <p className="text-[10px] text-[#00d2ff] font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                          {isAdmin ? (
                            <>
                              <ShieldAlert size={12} className="text-[#00d2ff]" />
                              Administrator
                            </>
                          ) : (
                            <>
                              <Sparkles size={12} className="text-[#00d2ff]" />
                              VIP Member
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="text-base font-bold text-white tracking-wide">AnOvA</h3>
                      <p className="text-xs text-zinc-400 leading-relaxed">Stream 4K Movies, TV Shows, and Anime in electric cyan & cobalt blue luxury.</p>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          setShowLoginModal(true);
                        }}
                        className="w-full py-2.5 rounded-xl btn-primary text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg"
                      >
                        Sign In / Register
                      </button>
                    </div>
                  )}
                </div>

                {/* Drawer Links */}
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#00d2ff]/80 px-3 mb-2">Categories</p>
                  {mainNavLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-[#0d1630] transition-colors"
                      >
                        <Icon size={16} className="text-[#00d2ff]" />
                        <span>{link.name}</span>
                      </Link>
                    );
                  })}

                  <div className="pt-4 border-t border-blue-500/20 space-y-1 mt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#00d2ff]/80 px-3 mb-2">Navigation</p>
                    {links.map((link) => {
                      const Icon = link.icon;
                      const isActive = location.pathname === link.path;
                      return (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors",
                            isActive 
                              ? "text-white bg-[#132046] border border-[#00d2ff]/40 shadow-[0_0_12px_rgba(0,210,255,0.3)]" 
                              : "text-zinc-300 hover:text-white hover:bg-[#0d1630]"
                          )}
                        >
                          <Icon size={16} className={isActive ? "text-[#00d2ff]" : "text-zinc-400"} />
                          <span>{link.name}</span>
                        </Link>
                      );
                    })}

                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#00d2ff] bg-[#0d1630] border border-[#00d2ff]/40 transition-colors mt-2"
                      >
                        <ShieldAlert size={16} />
                        <span>Admin Panel</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Sign Out Button */}
              {isLoggedIn && (
                <div className="pt-4 border-t border-blue-500/20">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 font-medium border border-blue-800/30 transition-colors text-xs cursor-pointer"
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-55 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="relative w-full max-w-md bg-[#060a14] border border-blue-500/30 p-7 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">AnOvA VIP</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Sign in for personalized watchlist & 4K streams</p>
                </div>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-[#0d1630] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 uppercase tracking-wider mb-2">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-[#0d1630] border border-blue-500/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00d2ff] transition-colors placeholder:text-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 uppercase tracking-wider mb-2">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-[#0d1630] border border-blue-500/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00d2ff] transition-colors placeholder:text-zinc-600"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl btn-primary text-white font-semibold text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg"
                  >
                    Sign In
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
