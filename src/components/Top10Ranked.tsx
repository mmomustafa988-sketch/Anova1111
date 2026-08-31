// @ts-nocheck
import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Anime } from '../types';
import { Star, Trophy, ArrowRight, Play } from 'lucide-react';
import { startTopLoading, preloadImage } from '../lib/topLoadingManager';
import { sanitizePosterUrl } from '../lib/api';

const GUARANTEED_FALLBACK_POSTER = "https://media.kitsu.app/anime/46231/poster_image/large-cdadff31f42490b9f48a035939a01a92.jpeg";

export function Top10Ranked({ animes }: { animes: Anime[] }) {
  const isMovedRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches[0]) {
      startPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      isMovedRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches && e.touches[0]) {
      const dx = Math.abs(e.touches[0].clientX - startPosRef.current.x);
      const dy = Math.abs(e.touches[0].clientY - startPosRef.current.y);
      if (dx > 6 || dy > 6) {
        isMovedRef.current = true;
      }
    }
  };

  const handleClick = (e: React.MouseEvent, animeId: string, poster?: string) => {
    if (isMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isMovedRef.current = false;
      return;
    }
    startTopLoading(`anime_${animeId}`);
    if (poster) preloadImage(poster);
  };

  if (!animes || animes.length === 0) return null;
  
  const top10 = animes.slice(0, 10);

  return (
    <div id="sec-top10" className="py-4 border-b border-white/[0.08] overflow-hidden">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Trophy size={18} className="text-cyan-400" />
          <span>🏆 TOP 10 TODAY</span>
        </h2>
        <Link 
          to="/search?sort=popularity"
          className="text-xs text-cyan-400 hover:text-white font-semibold uppercase tracking-wider transition-colors flex items-center gap-1 group/btn"
        >
          <span>View All</span>
          <ArrowRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div className="w-full overflow-x-auto scrollbar-none flex gap-5 sm:gap-7 px-1 pb-2 pt-1">
        {top10.map((anime, index) => {
          const rank = index + 1;
          const imdbScore = anime.rating 
            ? (typeof anime.rating === 'number' ? anime.rating.toFixed(1) : String(anime.rating))
            : (9.4 - index * 0.1).toFixed(1);
          const posterUrl = sanitizePosterUrl(anime.poster, anime.title, anime.id) || GUARANTEED_FALLBACK_POSTER;

          return (
            <div 
              key={anime.id || index} 
              className="flex items-end shrink-0 relative w-[120px] xs:w-[130px] sm:w-[148px] md:w-[162px] group select-none"
            >
              {/* Stylized Rank Number */}
              <div 
                className="absolute -left-2 sm:-left-3 bottom-0 z-10 font-black select-none pointer-events-none tracking-tighter leading-none"
                style={{
                  fontSize: '82px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  WebkitTextStroke: rank <= 3 ? '1.5px #22d3ee' : '1px rgba(255, 255, 255, 0.35)',
                  color: rank <= 3 ? 'rgba(34, 211, 238, 0.12)' : '#070b16',
                  textShadow: rank <= 3 ? '0 0 16px rgba(34, 211, 238, 0.4)' : 'none'
                }}
              >
                {rank}
              </div>

              {/* Poster Card overlapping number */}
              <Link 
                to={`/anime/${anime.id}`}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onClick={(e) => handleClick(e, anime.id, posterUrl)}
                className="flex-1 aspect-[10/14.5] relative rounded-xl sm:rounded-2xl overflow-hidden bg-[#0c1427] border border-white/[0.08] shadow-md transition-all duration-300 hover:scale-[1.02] hover:border-cyan-400/60 hover:shadow-[0_8px_25px_rgba(0,210,255,0.25)] ml-7 sm:ml-8 touch-action-manipulation"
              >
                <div className="w-full h-full relative">
                  <img 
                    src={posterUrl} 
                    alt={anime.title} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = GUARANTEED_FALLBACK_POSTER;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060a14] via-[#060a14]/25 to-transparent" />
                  
                  {/* Top Badges */}
                  <div className="absolute top-2 left-2 flex items-center gap-1 z-20">
                    <span className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-1.5 py-0.5 rounded text-[8px] font-black shadow-sm">
                      #{rank}
                    </span>
                  </div>

                  <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md text-[#FFC857] px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-0.5 border border-white/10 shadow-sm">
                    <Star size={8} fill="#FFC857" />
                    {imdbScore}
                  </div>

                  {/* Play Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 scale-90 group-hover:scale-100">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 p-[1px] shadow-[0_0_16px_rgba(0,210,255,0.8)]">
                      <div className="w-full h-full bg-[#060a14]/90 rounded-full flex items-center justify-center pl-0.5 text-white backdrop-blur-md">
                        <Play fill="currentColor" size={14} />
                      </div>
                    </div>
                  </div>

                  {/* Title & Type */}
                  <div className="absolute bottom-2 left-2 right-2 z-20">
                    <p className="text-[11px] sm:text-xs font-bold text-white line-clamp-1 group-hover:text-cyan-400 transition-colors">
                      {anime.title}
                    </p>
                    <p className="text-[9px] text-zinc-400 font-medium tracking-wider mt-0.5 uppercase flex items-center gap-1">
                      <span>{anime.type || 'TV'}</span>
                      <span>•</span>
                      <span className="text-cyan-400/90 font-semibold">{anime.episodes ? `${anime.episodes} EP` : 'HD'}</span>
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}


