// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, apiCache, fallbackAnimes, prefetchAnime, sanitizePosterUrl, sanitizeBannerUrl } from '../lib/api';
import { cleanAnimeTitleForDisplay } from '../lib/animeImportSystem';
import { Play, Heart, Bookmark, Star, ArrowLeft, Calendar, Film, Shield, BookOpen, MessageSquare } from 'lucide-react';
import { useAppStore } from '../store';
import { CommentSystem } from '../components/CommentSystem';
import { startTopLoading, finishTopLoading, preloadAnimeMedia } from '../lib/topLoadingManager';
import { isInvalidImage, fetchAnimeMetadata } from '../services/animeMetadataService';

export function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const currentAnimeIdRef = React.useRef(id);
  const lastIdRef = React.useRef(id);

  // Sync current ID ref instantly
  currentAnimeIdRef.current = id;

  // Function to format raw, kebab-case, or numeric titles cleanly
  const formatAnimeTitle = (rawTitle: any, animeId: any) => {
    let str = String(rawTitle || '').trim();
    if (!str || str.startsWith('Anime Series #') || str.startsWith('Anime #')) {
      const raw = String(animeId || str).replace(/^Anime\s*(?:Series\s*)?#/i, '');
      let clean = raw
        .replace(/^custom-/i, '')
        .replace(/^toonstream-(?:episode-)?/i, '')
        .replace(/^moviebox-/i, '')
        .replace(/^anikoto-/i, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      if (clean && !/^\d+$/.test(clean)) {
        return clean.replace(/\b\w/g, (c: string) => c.toUpperCase());
      }
      return `Anime #${raw.replace(/^custom-/i, '')}`;
    }
    let cleaned = cleanAnimeTitleForDisplay(str);
    if (/^\d+$/.test(cleaned) || /^custom-\d+$/i.test(cleaned)) {
      return `Anime #${cleaned.replace(/^custom-/i, '')}`;
    }
    return cleaned;
  };

  const [anime, setAnime] = useState<any>(() => {
    if (!id) return null;
    const cached = apiCache.get(`anime_info_${id}`);
    if (cached) {
      return { ...cached, title: formatAnimeTitle(cached.title, id) };
    }
    // Instantly match fallback anime to load pages instantaneously
    const matched = fallbackAnimes.find(a => String(a.id) === String(id));
    if (matched) {
      return { ...matched, title: formatAnimeTitle(matched.title, id) };
    }
    return null;
  });

  const [episodes, setEpisodes] = useState<any[]>(() => {
    if (!id) return [];
    const cached = apiCache.get(`episodes_${id}`);
    if (cached && cached.length > 0) return cached;
    // Instantly generate initial list of episodes for fallback anime so links are immediately clickable
    const matched = fallbackAnimes.find(a => String(a.id) === String(id));
    if (matched) {
      const totalEp = matched.episodes || 24;
      const eps = [];
      for (let i = 1; i <= Math.min(totalEp, 200); i++) {
        eps.push({ id: `${id}-ep-${i}`, number: i, title: `Episode ${i}` });
      }
      return eps;
    }
    return [];
  });

  // Track smoothly preloaded image URLs to prevent empty / skeleton or black flashes
  const [displayedPoster, setDisplayedPoster] = useState(() => sanitizePosterUrl(anime?.poster, anime?.title, id));
  const [displayedBanner, setDisplayedBanner] = useState(() => sanitizeBannerUrl(anime?.banner, anime?.poster, anime?.title, id));
  const [isMediaResolving, setIsMediaResolving] = useState(() => {
    const poster = anime?.poster;
    if (!poster || isInvalidImage(poster)) return true;
    return false;
  });

  // Render-phase State synchronization: Lock current anime data and load instantly on id param change
  if (id !== lastIdRef.current) {
    lastIdRef.current = id;
    startTopLoading();
    setIsMediaResolving(true);
    
    const initialAnime = (() => {
      if (!id) return null;
      const cached = apiCache.get(`anime_info_${id}`);
      if (cached) return { ...cached, title: formatAnimeTitle(cached.title, id) };
      const matched = fallbackAnimes.find(a => String(a.id) === String(id));
      if (matched) return { ...matched, title: formatAnimeTitle(matched.title, id) };
      return null;
    })();
    setAnime(initialAnime);
    const initPoster = sanitizePosterUrl(initialAnime?.poster, initialAnime?.title, id);
    const initBanner = sanitizeBannerUrl(initialAnime?.banner, initPoster, initialAnime?.title, id);
    setDisplayedPoster(initPoster);
    setDisplayedBanner(initBanner);

    const initialEpisodes = (() => {
      if (!id) return [];
      const cached = apiCache.get(`episodes_${id}`);
      if (cached && cached.length > 0) return cached;
      const matched = fallbackAnimes.find(a => String(a.id) === String(id));
      const targetAnime = initialAnime || matched;
      if (targetAnime) {
        const isMovie = (targetAnime.type && String(targetAnime.type).toLowerCase().includes('movie')) ||
                        targetAnime.categories?.movies === true;
        const totalEp = isMovie ? 1 : Number(targetAnime.episodes || targetAnime.episodesCount || 12);
        const eps = [];
        for (let i = 1; i <= Math.min(totalEp, 200); i++) {
          eps.push({ id: `${id}-ep-${i}`, number: i, title: isMovie ? 'Full Movie' : `Episode ${i}` });
        }
        return eps;
      }
      return [];
    })();
    setEpisodes(initialEpisodes);
  }

  // Instant trigger pre-fetching stream sources and anime metadata as soon as Detail mounts
  useEffect(() => {
    if (id) {
      prefetchAnime(id);
    }
  }, [id]);

  // Real media preloading for poster and banner
  useEffect(() => {
    if (!id) return;
    startTopLoading();

    const title = anime?.title || '';
    const rawPoster = anime?.poster;
    const rawBanner = anime?.banner || rawPoster;

    const posterUrl = sanitizePosterUrl(rawPoster, title, id);
    const bannerUrl = sanitizeBannerUrl(rawBanner, rawPoster, title, id);

    setDisplayedPoster(posterUrl);
    setDisplayedBanner(bannerUrl);

    const isPlaceholder = !posterUrl || isInvalidImage(posterUrl);
    if (isPlaceholder) {
      setIsMediaResolving(true);
      // Fetch rich metadata if current image is placeholder
      fetchAnimeMetadata(title || id).then((meta) => {
        if (currentAnimeIdRef.current !== id || !meta) return;
        if (meta.poster && !isInvalidImage(meta.poster)) {
          setDisplayedPoster(meta.poster);
        }
        if (meta.banner && !isInvalidImage(meta.banner)) {
          setDisplayedBanner(meta.banner);
        }
        setIsMediaResolving(false);
        finishTopLoading();
      }).catch(() => {
        setIsMediaResolving(false);
        finishTopLoading();
      });
    } else {
      setIsMediaResolving(false);
      finishTopLoading();
    }

    let isCancelled = false;
    preloadAnimeMedia(posterUrl, bannerUrl).then(({ posterLoaded, bannerLoaded }) => {
      if (isCancelled || currentAnimeIdRef.current !== id) return;
      if (posterUrl) setDisplayedPoster(posterUrl);
      if (bannerUrl) setDisplayedBanner(bannerUrl);
      if (!isInvalidImage(posterUrl)) {
        setIsMediaResolving(false);
        finishTopLoading();
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [anime?.poster, anime?.banner, anime?.title, id]);

  const [activeTab, setActiveTab] = useState('overview');
  const { favorites, bookmarks, addFavorite, removeFavorite, addBookmark, removeBookmark } = useAppStore();

  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const currentUserEmail = localStorage.getItem('userEmail') || '';

  useEffect(() => {
    if (!id) return;

    startTopLoading();
    const controller = new AbortController();

    // Set a timer to load fallback/placeholder anime if the real API takes more than 1.5 seconds
    const fallbackTimer = setTimeout(() => {
      if (currentAnimeIdRef.current !== id) return;

      setAnime((currentAnime) => {
        if (currentAnime) return currentAnime; // already loaded!
        console.warn(`[Detail Fallback] Anime details taking too long (>1.5s). Forcing fallback to avoid infinite skeleton loading...`);
        const matched = fallbackAnimes.find(a => String(a.id) === String(id));
        if (matched) return { ...matched, title: formatAnimeTitle(matched.title, id) };
        const cleanIdStr = String(id).replace(/^custom-/i, '');
        return {
          id: String(id),
          title: `Anime #${cleanIdStr}`,
          poster: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80",
          banner: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&auto=format&fit=crop&q=80",
          type: "TV",
          status: "Ongoing",
          episodes: 24,
          rating: "8.5",
          description: `This is a high-speed premium streaming channel for Anime #${cleanIdStr}. Start watching your favorite episodes instantly with zero ads, seamless sub/dub switching, and ultra-high speed servers.`,
          genres: ["Action", "Sci-Fi", "Adventure"],
          studio: "AnOvA Production"
        };
      });
      
      setEpisodes((currentEpisodes) => {
        if (currentEpisodes && currentEpisodes.length > 0) return currentEpisodes;
        // Pre-populate fallback episodes
        const eps = [];
        for (let i = 1; i <= 24; i++) {
          eps.push({ id: `${id}-ep-${i}`, number: i, title: `Episode ${i}` });
        }
        return eps;
      });
    }, 1500);

    // Background fetch from MAL, AniList, Firebase, or external API with AbortController
    api.animeInfo(id).then(async (res) => {
      if (controller.signal.aborted) return;
      if (currentAnimeIdRef.current !== id) {
        console.log(`[API Race Avoided] Detail animeInfo callback for id=${id} ignored because current id is ${currentAnimeIdRef.current}`);
        return;
      }
      if (res) {
        const formattedAnime = { ...res, title: formatAnimeTitle(res.title, id) };
        setAnime(formattedAnime);

        // Preload poster and banner from MAL/AniList/API before finishing loading
        const targetPoster = formattedAnime.poster;
        const targetBanner = formattedAnime.banner || formattedAnime.poster;
        if (targetPoster || targetBanner) {
          await preloadAnimeMedia(targetPoster, targetBanner);
          if (currentAnimeIdRef.current === id) {
            if (targetPoster) setDisplayedPoster(targetPoster);
            if (targetBanner) setDisplayedBanner(targetBanner);
            setIsMediaResolving(false);
            finishTopLoading();
          }
        } else {
          setIsMediaResolving(false);
          finishTopLoading();
        }
      }
    }).catch((err) => {
      console.error("api.animeInfo failed:", err);
      setIsMediaResolving(false);
      finishTopLoading();
    });

    api.episodes(id).then((res) => {
      if (controller.signal.aborted) return;
      if (currentAnimeIdRef.current !== id) {
        console.log(`[API Race Avoided] Detail episodes callback for id=${id} ignored because current id is ${currentAnimeIdRef.current}`);
        return;
      }
      if (res && res.length > 0) {
        setEpisodes(res);
      }
    }).catch((err) => {
      console.error("api.episodes failed:", err);
    });

    return () => {
      controller.abort();
      clearTimeout(fallbackTimer);
      finishTopLoading();
    };
  }, [id]);

  if (!anime) {
    return (
      <div className="min-h-screen bg-[#050505] pt-20">
        <div className="h-[40vh] md:h-[55vh] w-full bg-gradient-to-b from-[#0b1528]/40 to-[#050505] animate-pulse" />
        <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-24 relative z-10 grid grid-cols-[100px_1fr] md:grid-cols-[180px_1fr] gap-4 md:gap-8">
          <div className="aspect-[2/3] rounded-lg bg-white/5 animate-pulse" />
          <div className="space-y-3 pt-6">
            <div className="h-6 md:h-8 w-2/3 rounded bg-white/5 animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-white/5 animate-pulse" />
            <div className="h-3 w-full rounded bg-white/5 animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-white/5 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const isFav = favorites.some(f => f.id === anime.id);
  const isBookmarked = bookmarks.some(b => b.id === anime.id);

  return (
    <div className="min-h-screen pb-24 relative bg-[#050505]">
      {/* Hero Cover Image & Back Banner Container */}
      <div className="relative min-h-[460px] md:min-h-[500px] w-full overflow-hidden border-b border-white/5 flex flex-col justify-between pt-16 md:pt-20">
        {/* Background Banner Image */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <img 
            src={displayedBanner || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&auto=format&fit=crop&q=80'} 
            alt="" 
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover object-[center_20%] transition-all duration-500 ${isMediaResolving ? 'opacity-20 blur-sm' : 'opacity-35 md:opacity-25'}`} 
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&auto=format&fit=crop&q=80';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-[#050505]/40" />
          {isMediaResolving && (
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/10 to-transparent animate-pulse pointer-events-none" />
          )}
        </div>

        {/* Back Button Bar - Positioned comfortably at top left with z-30 */}
        <div className="relative z-30 px-4 md:px-8 max-w-7xl mx-auto w-full pt-2 pb-4">
          <button 
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#050c18]/90 hover:bg-[#00e5ff]/10 border border-[#00e5ff]/30 hover:border-[#00e5ff]/50 text-xs text-gray-200 hover:text-white font-bold transition-all duration-300 backdrop-blur-md shadow-lg hover:scale-105 active:scale-95 group cursor-pointer"
          >
            <ArrowLeft size={13} className="group-hover:-translate-x-1 transition-transform text-[#00e5ff]" />
            <span>Back</span>
          </button>
        </div>

        {/* Poster & details overlay */}
        <div className="relative z-20 w-full px-4 md:px-8 max-w-7xl mx-auto pb-6 mt-auto">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
            {/* Main Poster Container with Real-time Media Loading Indicator */}
            <div className="relative w-32 sm:w-36 md:w-44 aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.8)] border border-white/10 shrink-0 bg-[#0c1322] group">
              <img
                src={displayedPoster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80'}
                alt={anime.title}
                referrerPolicy="no-referrer"
                className={`w-full h-full object-cover transition-all duration-500 ${isMediaResolving ? 'blur-xs scale-105 opacity-40' : 'opacity-100 scale-100'}`}
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80';
                }}
              />

              {/* Active Media Loading Shimmer & Spinner while real poster is fetching/resolving */}
              {isMediaResolving && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] p-3 transition-opacity duration-300">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-2 drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]" />
                  <div className="text-[10px] font-black text-cyan-300 tracking-wider uppercase drop-shadow animate-pulse text-center">
                    Loading Artwork...
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent animate-pulse pointer-events-none" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-3 w-full sm:max-w-[460px]">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-tight drop-shadow-md line-clamp-2">
                {anime.title}
              </h1>

              {/* Action buttons: Watch Now full width, Add to List + More Seasons in 2 columns */}
              <div className="flex flex-col gap-2.5 w-full pt-1">
                <Link
                  to={anime.type === 'Trailer' ? `/watch/${anime.id}?ep=1` : `/watch/${anime.id}`}
                  onMouseEnter={() => prefetchAnime(anime.id)}
                  onTouchStart={() => prefetchAnime(anime.id)}
                  className="flex items-center justify-center gap-2 bg-primary hover:bg-[#00cce0] text-black w-full py-3 rounded-xl font-black text-xs md:text-sm transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(0,229,255,0.4)] uppercase tracking-wider"
                >
                  <Play size={16} fill="currentColor" /> {anime.type === 'Trailer' ? 'Play Trailer' : 'Watch Now'}
                </Link>

                <div className="grid grid-cols-2 gap-2 w-full">
                  <button
                    onClick={() => isFav ? removeFavorite(anime.id) : addFavorite(anime)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs border transition-all active:scale-[0.98] ${
                      isFav
                        ? 'bg-pink-500/10 text-pink-400 border-pink-500/40'
                        : 'bg-white/[0.05] text-white border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <Heart size={14} fill={isFav ? "currentColor" : "none"} />
                    <span className="truncate">{isFav ? 'Added' : '+ Add List'}</span>
                  </button>

                  <button
                    onClick={() => isBookmarked ? removeBookmark(anime.id) : addBookmark(anime)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs border transition-all active:scale-[0.98] ${
                      isBookmarked
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/40'
                        : 'bg-white/[0.05] text-white border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} />
                    <span className="truncate">Seasons</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Meta strip below hero */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="flex items-center gap-1 text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-2.5 py-1.5 rounded-lg">
            <Star size={12} fill="currentColor" /> {anime.rating || '8.5'}
          </span>
          <span className="bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg text-gray-200">{anime.type || 'TV'}</span>
          {String(anime.type || anime.format || '').toUpperCase() === 'MOVIE' || anime.categories?.['movies'] || anime.categories?.['movie'] ? (
            <span className="bg-blue-500/10 border border-blue-500/30 px-2.5 py-1.5 rounded-lg text-cyan-300">Full Movie</span>
          ) : (
            <span className="bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg text-gray-200">{anime.episodes || 12} Eps</span>
          )}
        </div>
        {anime.status && <p className="text-sm text-gray-400 mt-2 font-semibold">{anime.status}</p>}
        <p className="mt-2 text-sm text-yellow-400 font-bold flex items-center gap-1.5">
          <Star size={14} fill="currentColor" /> {anime.rating || '8.5'} — Rated for mature audiences
        </p>
      </div>


      {/* Tabs list bar */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8">
        <div className="flex gap-6 border-b border-white/5 pb-3 overflow-x-auto hide-scrollbar text-xs md:text-sm font-bold uppercase tracking-wider">
          {['overview', 'episodes', 'comments'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 -mb-[13px] border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab 
                  ? 'text-primary border-primary font-black drop-shadow-[0_0_10px_rgba(0,229,255,0.4)]' 
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Dynamic Tab Body content */}
        <div className="mt-8">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-4">
                <h3 className="text-base md:text-lg font-black text-white flex items-center gap-2">
                  <BookOpen size={18} className="text-primary" />
                  Synopsis
                </h3>
                <p 
                  className="text-gray-300 text-xs md:text-sm leading-relaxed whitespace-pre-wrap bg-[#0a0d14]/30 border border-white/5 rounded-xl p-5"
                  dangerouslySetInnerHTML={{ __html: anime.description || 'No detailed synopsis available.' }}
                />
              </div>
              
              <div className="space-y-4 bg-[#0a0d14]/40 p-6 rounded-2xl border border-white/5 h-fit">
                <h4 className="text-xs font-black text-white uppercase tracking-widest border-b border-white/5 pb-2 mb-2">Details</h4>
                <div>
                  <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Studio</span>
                  <p className="text-xs font-bold text-gray-200">{anime.studio || 'Unknown Studio'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Genres</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {anime.genres?.map((g: string) => (
                      <span key={g} className="bg-white/5 border border-white/10 px-2.5 py-1 rounded text-[10px] text-gray-300 font-bold">{g}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Format</span>
                  <p className="text-xs font-bold text-primary">{anime.type || 'TV Series'}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* EPISODES / MOVIE TAB */}
          {activeTab === 'episodes' && (
            <div className="space-y-4">
              <div className="mb-4">
                <h3 className="text-base md:text-lg font-black text-white flex items-center gap-2">
                  <Film size={18} className="text-primary" />
                  {String(anime.type || anime.format || '').toUpperCase() === 'MOVIE' || anime.categories?.['movies'] || anime.categories?.['movie']
                    ? 'Movie Video Stream'
                    : `Episodes List (${episodes.length})`}
                </h3>
              </div>
              {String(anime.type || anime.format || '').toUpperCase() === 'MOVIE' || anime.categories?.['movies'] || anime.categories?.['movie'] ? (
                <div className="py-6 flex justify-start">
                  <Link
                    to={`/watch/${anime.id}?ep=1`}
                    className="bg-gradient-to-r from-[#0066ff] to-[#00d2ff] hover:from-[#00d2ff] hover:to-[#0066ff] text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-[0_0_15px_rgba(0,210,255,0.4)] flex items-center gap-2"
                  >
                    <Play size={16} className="fill-white" />
                    Watch Full Movie Now
                  </Link>
                </div>
              ) : episodes.length === 0 ? (
                <div className="py-12 text-center text-gray-500 bg-white/[0.01] rounded-xl border border-white/5 border-dashed">
                  <p className="text-xs">No episodes listed yet for this series.</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2.5">
                  {episodes.map((ep: any) => (
                    <Link
                      key={ep.id}
                      to={`/watch/${anime.id}?ep=${ep.number}`}
                      onMouseEnter={() => prefetchAnime(anime.id, ep.number)}
                      onTouchStart={() => prefetchAnime(anime.id, ep.number)}
                      className="bg-[#0a0d14]/50 border border-white/5 hover:border-primary/50 text-gray-300 hover:text-primary py-2.5 rounded-xl flex items-center justify-center text-xs font-black transition-all hover:scale-105 active:scale-95 shadow-sm"
                    >
                      EP {ep.number}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* COMMENTS TAB */}
          {activeTab === 'comments' && (
            <div className="max-w-4xl">
              <CommentSystem animeId={anime.id} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
