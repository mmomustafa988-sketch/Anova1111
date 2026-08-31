import React from 'react';
import { Film, Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="relative w-full border-t border-blue-500/20 bg-[#060a14] pt-10 pb-10 px-4 z-10 text-center">
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-center gap-5">
        
        {/* Brand Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-[#00d2ff] p-[1px] shadow-[0_0_15px_rgba(0,210,255,0.3)]">
              <div className="w-full h-full bg-[#060a14] rounded-[11px] flex items-center justify-center">
                <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-[#00d2ff] text-sm">A</span>
              </div>
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              AnOvA<span className="text-[#00d2ff]">.</span>
            </span>
          </div>
          <p className="text-xs text-zinc-400 max-w-sm">
            Luxury anime & entertainment streaming platform in 4K Ultra HD.
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center items-center gap-5 text-xs text-zinc-400 font-medium">
          <a href="/home" className="hover:text-[#00d2ff] transition-colors">Home</a>
          <a href="/search?type=MOVIE" className="hover:text-[#00d2ff] transition-colors">Movies</a>
          <a href="/search?type=TV" className="hover:text-[#00d2ff] transition-colors">TV Series</a>
          <a href="/search?sort=popularity" className="hover:text-[#00d2ff] transition-colors">Popular</a>
          <a href="/profile" className="hover:text-[#00d2ff] transition-colors">Watchlist</a>
        </div>

        {/* Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-zinc-500 border-t border-blue-500/10 pt-5 w-full">
          <p>
            &copy; {new Date().getFullYear()} <span className="text-zinc-300 font-semibold">AnOvA</span>. All rights reserved.
          </p>
          <span className="hidden sm:inline text-zinc-700">•</span>
          <p className="flex items-center gap-1 text-zinc-400">
            <span>Crafted for anime & entertainment lovers</span>
            <Heart size={12} className="text-[#00d2ff] fill-[#00d2ff]" />
          </p>
        </div>

      </div>
    </footer>
  );
}


