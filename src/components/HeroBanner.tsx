// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Anime } from '../types';
import { Play, Info, Star, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fallbackAnimes, prefetchAnime, sanitizeBannerUrl } from '../lib/api';
import { cleanAnimeTitleForDisplay } from '../lib/animeImportSystem';
import { startTopLoading, preloadImage } from '../lib/topLoadingManager';

export function HeroBanner({ trending }: { trending: Anime[] }) {
  const [current, setCurrent] = useState(0);

  const displayAnimes = (trending && trending.length > 0) ? trending : fallbackAnimes.slice(0, 5);

  useEffect(() => {
    if (!displayAnimes || displayAnimes.length === 0) return;
    const interval = setInterval(() => {
      setCurrent((c) => (c + 1) % Math.min(displayAnimes.length, 5));
    }, 7000);
    return () => clearInterval(interval);
  }, [displayAnimes]);

  if (!displayAnimes || displayAnimes.length === 0) {
    return null;
  }

  const animes = displayAnimes.slice(0, 5);
  const anime = animes[current] || animes[0];

  if (!anime) return null;

  const displayTitle = (() => {
    const clean = cleanAnimeTitleForDisplay(anime.title);
    if (/^\d+$/.test(clean) || /^custom-\d+$/i.test(anime.title)) {
      return `Anime Title #${String(anime.id || anime.title).replace(/^custom-/i, '')}`;
    }
    return clean;
  })();

  const imdbRating = anime.rating || (8.4 + (current * 0.2)).toFixed(1);

  return (
    <div className="relative w-full h-[70vh] md:h-[82vh] overflow-hidden hero border-b border-blue-500/20">
      {/* Glitter texture overlay */}
      <div className="absolute inset-0 glitter-texture pointer-events-none z-[1]" />

      {/* Background Banner Slides */}
      {animes.map((item, idx) => (
        <div 
          key={item.id}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out z-0"
          style={{ opacity: idx === current ? 1 : 0 }}
        >
          <img 
            src={sanitizeBannerUrl(item.banner, item.poster, item.title, item.id)} 
            alt={cleanAnimeTitleForDisplay(item.title)}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-[center_25%] opacity-55 md:opacity-40 transition-transform duration-[8000ms] ease-out bg-[#060a14]"
            style={{ transform: idx === current ? 'scale(1.03)' : 'scale(1.0)' }}
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&auto=format&fit=crop&q=80';
            }}
          />
          {/* Glossy gradient vignettes */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#060a14] via-[#060a14]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#060a14] via-[#060a14]/85 to-transparent" />
        </div>
      ))}

      {/* Top Subtle Overlay */}
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-[#060a14] to-transparent pointer-events-none z-[2]" />

      {/* Slide Content */}
      <div className="absolute inset-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-16 z-10">
        <div className="max-w-2xl space-y-4">
          
          {/* Badges Row */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="bg-[#0d1630]/90 text-zinc-200 text-[10px] md:text-xs font-semibold px-3 py-1 rounded-lg uppercase tracking-widest border border-blue-500/30 shadow-md">
              FEATURED #{current + 1}
            </span>

            <span className="bg-[#FFC857] text-black font-extrabold text-[10px] md:text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
              <Star size={11} fill="black" />
              IMDb {imdbRating}
            </span>

            <span className="bg-[#0d1630] border border-[#00d2ff]/50 text-[#00d2ff] font-bold text-[10px] md:text-xs px-2.5 py-1 rounded-lg shadow-sm">
              4K ULTRA HD
            </span>

            <span className="bg-[#0d1630] border border-blue-500/30 text-blue-300 text-[10px] md:text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Volume2 size={12} /> DOLBY ATMOS
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white leading-none tracking-tight line-clamp-2 drop-shadow-xl">
            {displayTitle}
          </h1>
          
          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs md:text-sm text-zinc-300 font-medium">
            <span className="text-white font-semibold bg-[#132046] px-2.5 py-0.5 rounded border border-blue-500/30">
              {anime.type || 'MOVIE'}
            </span>
            <span>•</span>
            <span className="text-zinc-200">{anime.released || '2024'}</span>
            <span>•</span>
            <span className="gradient-text font-bold">DUAL AUDIO</span>
            {anime.studio && (
              <>
                <span>•</span>
                <span className="text-zinc-300">{anime.studio}</span>
              </>
            )}
          </div>

          {/* Synopsis */}
          <p className="text-zinc-300 max-w-xl text-xs md:text-sm leading-relaxed line-clamp-2 md:line-clamp-3">
            {anime.description || "Stream the latest anime releases and series in crystal clear 4K Ultra HD. Premium high-speed servers, spatial audio, and fast playback with zero ads."}
          </p>

          {/* Primary & Secondary Buttons */}
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <Link
              to={`/watch/${anime.id}`}
              onMouseEnter={() => prefetchAnime(anime.id)}
              onTouchStart={() => prefetchAnime(anime.id)}
              onClick={() => {
                startTopLoading(`anime_${anime.id}`);
                if (anime.poster) preloadImage(anime.poster);
              }}
              className="flex items-center gap-2.5 btn-primary font-extrabold text-xs md:text-sm px-7 py-3 rounded-xl transition-all duration-300 active:scale-95 cursor-pointer shadow-xl"
            >
              <Play fill="white" size={15} />
              <span>WATCH IN 4K</span>
            </Link>

            <Link
              to={`/anime/${anime.id}`}
              onMouseEnter={() => prefetchAnime(anime.id)}
              onTouchStart={() => prefetchAnime(anime.id)}
              onClick={() => {
                startTopLoading(`anime_${anime.id}`);
                if (anime.poster) preloadImage(anime.poster);
              }}
              className="flex items-center gap-2 bg-[#0d1630]/80 hover:bg-[#132046] text-zinc-200 hover:text-white font-medium text-xs md:text-sm px-6 py-3 rounded-xl border border-blue-500/30 hover:border-[#00d2ff]/60 transition-all duration-300 active:scale-95 cursor-pointer backdrop-blur-md"
            >
              <Info size={15} className="text-[#00d2ff]" />
              <span>DETAILS</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Slide Indicators */}
      <div className="absolute bottom-8 right-4 md:right-8 flex gap-2 z-10">
        {animes.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              idx === current 
                ? 'w-8 bg-gradient-to-r from-[#0066ff] to-[#00d2ff] shadow-[0_0_10px_#00d2ff]' 
                : 'w-2 bg-white/20 hover:bg-white/40'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

