// @ts-nocheck
import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Star, Volume2 } from 'lucide-react';
import { Anime } from '../types';
import { cn } from '../lib/utils';
import { prefetchAnime, sanitizePosterUrl } from '../lib/api';
import { cleanAnimeTitleForDisplay } from '../lib/animeImportSystem';
import { startTopLoading, preloadImage } from '../lib/topLoadingManager';
import { isInvalidImage, fetchAnimeMetadata, getCachedMetadata } from '../services/animeMetadataService';
import { COMPREHENSIVE_ANIME_CATALOG } from '../data/animeDatabase';

interface AnimeCardProps {
  anime: Anime;
  className?: string;
  key?: any;
}

const GUARANTEED_FALLBACK_POSTER = "https://media.kitsu.app/anime/46231/poster_image/large-cdadff31f42490b9f48a035939a01a92.jpeg";

export function AnimeCard({ anime, className }: AnimeCardProps) {
  const isMovedRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const retryCountRef = useRef(0);

  const initialPoster = sanitizePosterUrl(anime.poster, anime.title, anime.id) || GUARANTEED_FALLBACK_POSTER;
  const [posterUrl, setPosterUrl] = useState<string>(initialPoster);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Synchronize posterUrl if anime changes
  useEffect(() => {
    retryCountRef.current = 0;
    const resolved = sanitizePosterUrl(anime.poster, anime.title, anime.id);
    if (resolved && !isInvalidImage(resolved)) {
      setPosterUrl(resolved);
    } else {
      fetchAnimeMetadata(anime.title || '').then(meta => {
        if (meta?.poster && !isInvalidImage(meta.poster)) {
          setPosterUrl(meta.poster);
        }
      }).catch(() => {});
    }
  }, [anime.poster, anime.title, anime.id]);

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

  const handleClick = (e: React.MouseEvent) => {
    if (isMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isMovedRef.current = false;
      return;
    }
    startTopLoading(`anime_${anime.id}`);
    if (posterUrl) {
      preloadImage(posterUrl);
    }
  };

  const handleImageError = () => {
    retryCountRef.current += 1;
    if (retryCountRef.current === 1) {
      // Try resolving via clean catalog match
      const cleanTitle = (anime.title || '').toLowerCase().trim();
      const match = COMPREHENSIVE_ANIME_CATALOG.find(c => 
        c.title.toLowerCase() === cleanTitle || 
        c.title.toLowerCase().includes(cleanTitle) ||
        cleanTitle.includes(c.title.toLowerCase())
      );
      if (match?.poster && match.poster !== posterUrl && !isInvalidImage(match.poster)) {
        setPosterUrl(match.poster);
        return;
      }
    }

    if (retryCountRef.current <= 2) {
      fetchAnimeMetadata(anime.title || '').then(meta => {
        if (meta?.poster && meta.poster !== posterUrl && !isInvalidImage(meta.poster)) {
          setPosterUrl(meta.poster);
        } else {
          setPosterUrl(GUARANTEED_FALLBACK_POSTER);
        }
      }).catch(() => {
        setPosterUrl(GUARANTEED_FALLBACK_POSTER);
      });
    } else {
      setPosterUrl(GUARANTEED_FALLBACK_POSTER);
    }
  };

  const hasSub = anime.subAvailable !== undefined ? anime.subAvailable : true;
  const hasDub = anime.dubAvailable !== undefined ? anime.dubAvailable : (Number(anime.id) % 2 === 0 || (anime.title || '').length % 2 === 0);
  const hasHindi = anime.hindiAvailable !== undefined ? anime.hindiAvailable : false;

  // Dub badge detection
  const primaryDubBadge = (() => {
    const explicit = anime.language || anime.audioLanguage || anime.dubLanguage || anime.audio || anime.audioTrack;
    if (explicit && typeof explicit === 'string' && explicit.trim()) {
      return explicit.replace(/\[|\]|\(|\)/g, '').trim();
    }
    const titleLower = (anime.title || '').toLowerCase();
    if (titleLower.includes('hindi') || titleLower.includes('[hindi]')) return 'Hindi';
    if (titleLower.includes('bengali') || titleLower.includes('[bengali]')) return 'Bengali';
    if (titleLower.includes('dual audio') || titleLower.includes('multi audio')) return 'Dual';
    if (titleLower.includes('english') || titleLower.includes('eng dub')) return 'Eng Dub';
    if (anime.hindiAvailable) return 'Hindi';
    if (anime.dubAvailable) return 'Dub';
    return 'Sub';
  })();

  const displayTitle = (() => {
    const clean = cleanAnimeTitleForDisplay(anime.title);
    if (/^\d+$/.test(clean) || /^custom-\d+$/i.test(anime.title)) {
      return `Title #${String(anime.id || anime.title).replace(/^custom-/i, '')}`;
    }
    return clean;
  })();

  const imdbScore = anime.rating 
    ? (typeof anime.rating === 'number' ? anime.rating.toFixed(1) : String(anime.rating))
    : (8.0 + (Number(anime.id || 1) % 18) / 10).toFixed(1);

  const isMovie = String(anime.type || anime.format || '').toUpperCase() === 'MOVIE' || 
                  anime.categories?.['movies'] === true || 
                  anime.categories?.['movie'] === true;

  return (
    <Link
      to={`/anime/${anime.id}`}
      onMouseEnter={() => prefetchAnime(anime.id)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onClick={handleClick}
      className={cn(
        "group block relative rounded-xl sm:rounded-2xl overflow-hidden bg-[#0c1427] border border-white/[0.08] shadow-md transition-all duration-300 ease-out hover:scale-[1.02] hover:border-cyan-400/60 hover:shadow-[0_8px_25px_rgba(0,210,255,0.25)] touch-action-manipulation",
        className
      )}
    >
      {/* Poster Aspect Ratio Container */}
      <div className="aspect-[10/14.5] relative overflow-hidden bg-[#070c18] select-none">
        {/* Subtle Shimmer Skeleton while loading */}
        {!imgLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-[#091122] via-[#13203c] to-[#091122] animate-pulse" />
        )}

        <img
          src={posterUrl}
          alt={displayTitle}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setImgLoaded(true)}
          onError={handleImageError}
          className={cn(
            "w-full h-full object-cover transition-all duration-500 group-hover:scale-105",
            imgLoaded ? "opacity-100" : "opacity-90"
          )}
        />

        {/* Cinematic Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060a14] via-[#060a14]/20 to-transparent opacity-75 group-hover:opacity-90 transition-opacity" />

        {/* Floating Play Button on Hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 scale-90 group-hover:scale-100 pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 p-[1px] shadow-[0_0_16px_rgba(0,210,255,0.8)]">
            <div className="w-full h-full bg-[#060a14]/90 rounded-full flex items-center justify-center pl-0.5 text-white backdrop-blur-md">
              <Play size={16} className="fill-white text-white" />
            </div>
          </div>
        </div>

        {/* Sleek Minimalist Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-center gap-1 pointer-events-none z-10">
          {/* Gold IMDb rating badge */}
          <span className="bg-[#FFC857] text-black font-black text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-md shadow flex items-center gap-0.5 leading-none">
            <Star size={8} fill="black" />
            {imdbScore}
          </span>

          {/* Clean Audio Dub badge */}
          {primaryDubBadge && (
            <span className={cn(
              "backdrop-blur-md px-1.5 py-0.5 rounded-md text-[8px] sm:text-[8.5px] font-bold uppercase tracking-wider leading-none shadow-sm",
              primaryDubBadge.toLowerCase().includes('hindi')
                ? "bg-amber-500/90 text-black border border-amber-300 font-extrabold"
                : primaryDubBadge.toLowerCase().includes('dub')
                  ? "bg-blue-600/85 text-white border border-blue-400/40"
                  : "bg-black/75 text-cyan-300 border border-cyan-500/30"
            )}>
              {primaryDubBadge}
            </span>
          )}
        </div>

        {/* Subtle Bottom-Right Quality Pill */}
        <div className="absolute bottom-2 right-2 pointer-events-none z-10 flex gap-1 items-center">
          <span className="text-[7.5px] font-bold px-1 py-0.5 rounded bg-black/70 backdrop-blur-md text-zinc-300 border border-white/10 leading-none">
            {isMovie ? '4K' : (anime.episodes ? `${anime.episodes}E` : 'HD')}
          </span>
        </div>
      </div>

      {/* Refined Compact Info Body */}
      <div className="p-2 sm:p-2.5 relative z-10 flex flex-col justify-between bg-gradient-to-b from-[#0c1427] to-[#080e1c]">
        <h3 className="font-bold text-[11px] sm:text-xs leading-snug line-clamp-1 group-hover:text-cyan-400 transition-colors text-white">
          {displayTitle}
        </h3>
        
        <div className="flex items-center justify-between mt-1 text-[9px] sm:text-[10px] text-zinc-400 font-medium">
          <span className="uppercase text-[8.5px] sm:text-[9px] text-zinc-400">
            {anime.type || 'TV'} • {anime.released || '2024'}
          </span>
          <span className="text-cyan-400/90 font-semibold text-[8.5px] sm:text-[9px]">
            {isMovie ? 'Movie' : (anime.episodes ? `${anime.episodes} EP` : 'Anime')}
          </span>
        </div>
      </div>
    </Link>
  );
}

