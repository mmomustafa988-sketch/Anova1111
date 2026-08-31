// @ts-nocheck
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Anime } from '../types';
import { HeroBanner } from '../components/HeroBanner';
import { AnimeCard } from '../components/AnimeCard';
import { Top10Ranked } from '../components/Top10Ranked';
import { api, brokenAnimesSet, sanitizePosterUrl, hasCategory } from '../lib/api';
import { useAppStore } from '../store';
import { Play, RotateCcw, ChevronLeft, ChevronRight, ArrowRight, Search as SearchIcon, X, Sparkles, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { HeroBannerSkeleton } from '../components/Skeletons';
import { COMPREHENSIVE_ANIME_CATALOG } from '../data/animeDatabase';

const ALPHABET_LIST = ['#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

const mapAnime = (a: any) => {
  if (!a) return a;
  const title = a.titles?.english || a.titles?.romaji || a.title || 'Anime Series';
  const id = String(a.id || '');
  const poster = sanitizePosterUrl(a.images?.poster || a.poster, title, id);
  const banner = a.images?.banner || a.banner || a.images?.poster || a.poster || poster;
  return {
    ...a,
    id,
    poster,
    banner,
    title
  };
};

const isBrokenAnime = (anime: any) => {
  if (!anime) return true;
  const idStr = String(anime.id || '');
  if (idStr === 'yt-pl-PLxSscENEp7JgVHy1m2-yD5jbgOGDyqSLc' || idStr.includes('PLxSscENEp7JgVHy1m2-yD5jbgOGDyqSLc') || brokenAnimesSet.has(idStr)) {
    return true;
  }
  if (!anime.title || anime.title === 'Unknown Title') {
    return true;
  }
  return false;
};

// Check if anime is strictly a cartoon
const isCartoonItem = (a: any) => {
  if (!a) return false;
  if (a.isCartoon === true || a.type === 'Cartoon' || a.format === 'CARTOON') return true;
  if (a.categories && (a.categories.cartoon === true || a.categories.cartoons === true || a.categories['just-in-cartoons'] === true)) return true;
  if (Array.isArray(a.genres) && a.genres.some((g: string) => String(g).toLowerCase().includes('cartoon'))) return true;
  return false;
};

// Check if anime is an actual movie
const isStrictMovie = (a: any) => {
  if (!a) return false;
  const typeStr = String(a.type || a.format || '').toLowerCase();
  if (typeStr === 'movie' || typeStr === 'film') return true;
  if (a.categories?.movies === true || a.categories?.movie === true) return true;
  if (Array.isArray(a.genres) && a.genres.some((g: string) => String(g).toLowerCase() === 'movie' || String(g).toLowerCase() === 'film')) return true;
  return false;
};

interface HomeSectionRowProps {
  id: string;
  title: string;
  link: string;
  items: Anime[];
  loading?: boolean;
}

function HomeSectionRow({ id, title, link, items, loading = false }: HomeSectionRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const amount = clientWidth * 0.75;
      scrollRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - amount : scrollLeft + amount,
        behavior: 'smooth'
      });
    }
  };

  if (!loading && (!items || items.length === 0)) {
    return null;
  }

  return (
    <div id={`sec-${id}`} className="py-4 border-b border-blue-500/15 relative group">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
          {title}
        </h2>
        <Link 
          to={link}
          className="text-xs text-[#00d2ff] hover:text-white font-semibold uppercase tracking-wider transition-colors flex items-center gap-1 group/btn"
        >
          <span>View All</span>
          <ArrowRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="flex gap-3 sm:gap-3.5 pb-2 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div 
              key={i} 
              className="w-[118px] xs:w-[128px] sm:w-[145px] md:w-[160px] shrink-0 animate-pulse bg-[#0c1427] border border-white/[0.08] rounded-xl sm:rounded-2xl aspect-[10/14.5] flex flex-col justify-end p-2.5"
            >
              <div className="w-3/4 h-2.5 bg-white/10 rounded mb-1.5" />
              <div className="w-1/2 h-2 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative">
          {/* Scroll Navigation Buttons */}
          {showLeftArrow && (
            <button
              onClick={() => scroll('left')}
              aria-label="Scroll left"
              className="absolute left-1 top-1/2 -translate-y-1/2 z-30 bg-[#0c1427]/90 hover:bg-[#13203c] text-white p-2 rounded-full border border-white/20 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          {showRightArrow && (
            <button
              onClick={() => scroll('right')}
              aria-label="Scroll right"
              className="absolute right-1 top-1/2 -translate-y-1/2 z-30 bg-[#0c1427]/90 hover:bg-[#13203c] text-white p-2 rounded-full border border-white/20 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          )}

          {/* Horizontal Anime Card Row */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex gap-3 sm:gap-3.5 overflow-x-auto scrollbar-none scroll-smooth pb-2 touch-pan-x"
          >
            {items.map((anime) => (
              <div
                key={anime.id}
                className="w-[118px] xs:w-[128px] sm:w-[145px] md:w-[160px] shrink-0"
              >
                <AnimeCard anime={anime} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [trendingHero, setTrendingHero] = useState<Anime[]>([]);
  
  // Section data states (strictly deduplicated across sections)
  const [top10Anime, setTop10Anime] = useState<Anime[]>([]);
  const [justInCartoonsAnime, setJustInCartoonsAnime] = useState<Anime[]>([]);
  const [mustWatchAnime, setMustWatchAnime] = useState<Anime[]>([]);
  const [mustWatchFilmsAnime, setMustWatchFilmsAnime] = useState<Anime[]>([]);
  const [mostWatchedAnime, setMostWatchedAnime] = useState<Anime[]>([]);
  const [newArrivalsAnime, setNewArrivalsAnime] = useState<Anime[]>([]);
  const [latestEpisodesAnime, setLatestEpisodesAnime] = useState<Anime[]>([]);
  const [latestMoviesAnime, setLatestMoviesAnime] = useState<Anime[]>([]);
  const [trendingAnime, setTrendingAnime] = useState<Anime[]>([]);
  
  // All loaded anime catalogue for instant A-Z lookup
  const [allCatalogAnime, setAllCatalogAnime] = useState<Anime[]>([]);

  // Quick A to Z State
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [azSearchQuery, setAzSearchQuery] = useState('');
  const [liveAzResults, setLiveAzResults] = useState<Anime[]>([]);
  const [azLoading, setAzLoading] = useState(false);
  const letterResultsRef = useRef<HTMLDivElement>(null);

  const isCwMovedRef = useRef(false);
  const cwStartPosRef = useRef({ x: 0, y: 0 });

  const handleCwTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches[0]) {
      cwStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      isCwMovedRef.current = false;
    }
  };

  const handleCwTouchMove = (e: React.TouchEvent) => {
    if (e.touches && e.touches[0]) {
      const dx = Math.abs(e.touches[0].clientX - cwStartPosRef.current.x);
      const dy = Math.abs(e.touches[0].clientY - cwStartPosRef.current.y);
      if (dx > 6 || dy > 6) {
        isCwMovedRef.current = true;
      }
    }
  };

  const handleCwClick = (e: React.MouseEvent) => {
    if (isCwMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isCwMovedRef.current = false;
    }
  };

  const { watchHistory } = useAppStore();
  const continueWatchingList = Object.values(watchHistory || {})
    .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
    .slice(0, 6);

  // Main data loader with strict cross-section deduplication
  const loadHomeData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch data feeds concurrently
      const [rawHome, popularFeed, recentFeed, updatedFeed, moviesFeed, trendingFeed, cartoonsFeed] = await Promise.allSettled([
        api.home(true),
        api.popular(),
        api.recent(),
        api.updated(),
        api.category('movies'),
        api.trending(),
        api.category('cartoons')
      ]);

      const homeData = rawHome.status === 'fulfilled' ? rawHome.value : null;

      // Extract raw lists
      const rawTrendingList = [
        ...(homeData?.data?.trending || []),
        ...(trendingFeed.status === 'fulfilled' ? trendingFeed.value : [])
      ].map(mapAnime).filter(a => !isBrokenAnime(a));

      const rawPopularList = [
        ...(homeData?.data?.mostPopular || []),
        ...(popularFeed.status === 'fulfilled' ? popularFeed.value : [])
      ].map(mapAnime).filter(a => !isBrokenAnime(a));

      const rawRecentList = [
        ...(homeData?.data?.newAdded || []),
        ...(recentFeed.status === 'fulfilled' ? recentFeed.value : [])
      ].map(mapAnime).filter(a => !isBrokenAnime(a));

      const rawUpdatedList = [
        ...(homeData?.data?.latestEpisode || []),
        ...(updatedFeed.status === 'fulfilled' ? updatedFeed.value : [])
      ].map(mapAnime).filter(a => !isBrokenAnime(a));

      const rawMoviesList = [
        ...(moviesFeed.status === 'fulfilled' ? moviesFeed.value : [])
      ].map(mapAnime).filter(a => !isBrokenAnime(a)).filter(isStrictMovie);

      const rawCartoonsFeedList = (cartoonsFeed.status === 'fulfilled' ? cartoonsFeed.value : [])
        .map(mapAnime).filter(a => !isBrokenAnime(a));

      // Build cartoons pool strictly
      const catalogCartoons = COMPREHENSIVE_ANIME_CATALOG.filter(isCartoonItem).map(mapAnime);
      const rawCartoonsList = [...catalogCartoons, ...rawCartoonsFeedList.filter(isCartoonItem)];

      // Build must-watch series pool
      const catalogMustWatchSeries = COMPREHENSIVE_ANIME_CATALOG
        .filter(a => !isCartoonItem(a) && !isStrictMovie(a) && (parseFloat(a.rating || '0') >= 8.8 || a.categories?.favorite || a.categories?.topAiring))
        .map(mapAnime);
      const rawMustWatchSeriesList = [
        ...catalogMustWatchSeries,
        ...rawPopularList.filter(a => !isCartoonItem(a) && !isStrictMovie(a) && parseFloat(a.rating || '0') >= 8.8),
        ...rawTrendingList.filter(a => !isCartoonItem(a) && !isStrictMovie(a) && parseFloat(a.rating || '0') >= 8.8)
      ];

      // Build must-watch films pool
      const catalogMustWatchFilms = COMPREHENSIVE_ANIME_CATALOG
        .filter(a => !isCartoonItem(a) && isStrictMovie(a) && (parseFloat(a.rating || '0') >= 8.6 || a.categories?.favorite || a.categories?.movies))
        .map(mapAnime);
      const rawMustWatchFilmsList = [
        ...catalogMustWatchFilms,
        ...rawMoviesList.filter(a => !isCartoonItem(a) && isStrictMovie(a) && parseFloat(a.rating || '0') >= 8.6)
      ];

      // Collect complete catalog for A-Z lookup
      const fullCatalogMap = new Map<string, Anime>();
      
      // 0. Seed fullCatalogMap with Comprehensive Catalog (All letters A-Z + numbers)
      COMPREHENSIVE_ANIME_CATALOG.forEach(c => {
        const mapped = mapAnime(c);
        if (!isBrokenAnime(mapped)) {
          fullCatalogMap.set(String(mapped.id), mapped);
        }
      });

      [...rawTrendingList, ...rawPopularList, ...rawRecentList, ...rawUpdatedList, ...rawMoviesList, ...rawCartoonsList].forEach(a => {
        if (a && a.id && a.title && !isBrokenAnime(a)) {
          fullCatalogMap.set(String(a.id), a);
        }
      });

      // Try fetching additional catalog items for rich A-Z search
      try {
        const extraSearch = await api.search('', 1, {});
        if (extraSearch && Array.isArray(extraSearch.data)) {
          extraSearch.data.forEach(a => {
            const mapped = mapAnime(a);
            if (!isBrokenAnime(mapped)) {
              fullCatalogMap.set(String(mapped.id), mapped);
            }
          });
        }
      } catch (_) {}

      setAllCatalogAnime(Array.from(fullCatalogMap.values()));

      // =========================================================================
      // STRICT CROSS-SECTION DEDUPLICATION PIPELINE
      // An anime will NEVER appear more than once anywhere across the Home page!
      // =========================================================================
      const usedIds = new Set<string>();

      // 0. Hero Spotlight (Top 5-6 anime, excluding cartoons)
      const heroSpotlight: Anime[] = [];
      for (const a of rawTrendingList) {
        const idStr = String(a.id);
        if (!usedIds.has(idStr) && !isCartoonItem(a)) {
          usedIds.add(idStr);
          heroSpotlight.push(a);
          if (heroSpotlight.length >= 6) break;
        }
      }
      setTrendingHero(heroSpotlight);

      // 1. 🏆 TOP 10 (10 unique top-ranked anime, excluding cartoons)
      const top10: Anime[] = [];
      const topPool = [
        ...rawTrendingList,
        ...rawPopularList,
        ...COMPREHENSIVE_ANIME_CATALOG.filter(a => !isCartoonItem(a)).map(mapAnime)
      ];
      for (const a of topPool) {
        const idStr = String(a.id);
        if (!usedIds.has(idStr) && !isCartoonItem(a) && !isBrokenAnime(a)) {
          usedIds.add(idStr);
          top10.push(a);
          if (top10.length >= 10) break;
        }
      }
      setTop10Anime(top10);

      // 2. 🎨 Just In Cartoons (Strictly cartoons only, e.g. Ben 10, Transformers, Loud House, etc.)
      const cartoonsSec: Anime[] = [];
      for (const a of rawCartoonsList) {
        const idStr = String(a.id);
        if (!usedIds.has(idStr) && isCartoonItem(a) && !isBrokenAnime(a)) {
          usedIds.add(idStr);
          cartoonsSec.push(a);
          if (cartoonsSec.length >= 14) break;
        }
      }
      setJustInCartoonsAnime(cartoonsSec);

      // 3. 🌟 Must Watch Anime (Legendary series, e.g. Death Note, AOT, Steins;Gate, Solo Leveling, etc.)
      const mustWatchSec: Anime[] = [];
      for (const a of rawMustWatchSeriesList) {
        const idStr = String(a.id);
        if (!usedIds.has(idStr) && !isCartoonItem(a) && !isStrictMovie(a) && !isBrokenAnime(a)) {
          usedIds.add(idStr);
          mustWatchSec.push(a);
          if (mustWatchSec.length >= 12) break;
        }
      }
      // Fill if needed from catalog
      if (mustWatchSec.length < 10) {
        for (const c of COMPREHENSIVE_ANIME_CATALOG) {
          const a = mapAnime(c);
          const idStr = String(a.id);
          if (!usedIds.has(idStr) && !isCartoonItem(a) && !isStrictMovie(a) && parseFloat(a.rating || '0') >= 8.5) {
            usedIds.add(idStr);
            mustWatchSec.push(a);
            if (mustWatchSec.length >= 12) break;
          }
        }
      }
      setMustWatchAnime(mustWatchSec);

      // 4. 🍿 Must Watch Anime Films (Masterpiece movies, e.g. Your Name, Spirited Away, A Silent Voice, etc.)
      const mustWatchFilmsSec: Anime[] = [];
      for (const a of rawMustWatchFilmsList) {
        const idStr = String(a.id);
        if (!usedIds.has(idStr) && !isCartoonItem(a) && isStrictMovie(a) && !isBrokenAnime(a)) {
          usedIds.add(idStr);
          mustWatchFilmsSec.push(a);
          if (mustWatchFilmsSec.length >= 12) break;
        }
      }
      // Fill if needed from catalog
      if (mustWatchFilmsSec.length < 10) {
        for (const c of COMPREHENSIVE_ANIME_CATALOG) {
          const a = mapAnime(c);
          const idStr = String(a.id);
          if (!usedIds.has(idStr) && !isCartoonItem(a) && isStrictMovie(a)) {
            usedIds.add(idStr);
            mustWatchFilmsSec.push(a);
            if (mustWatchFilmsSec.length >= 12) break;
          }
        }
      }
      setMustWatchFilmsAnime(mustWatchFilmsSec);

      // 5. 🔥 Most Watched Anime (Up to 12 unique items)
      const mostWatched: Anime[] = [];
      for (const a of rawPopularList) {
        const idStr = String(a.id);
        if (!usedIds.has(idStr) && !isCartoonItem(a)) {
          usedIds.add(idStr);
          mostWatched.push(a);
          if (mostWatched.length >= 12) break;
        }
      }
      if (mostWatched.length < 10) {
        for (const c of COMPREHENSIVE_ANIME_CATALOG) {
          const a = mapAnime(c);
          const idStr = String(a.id);
          if (!usedIds.has(idStr) && !isCartoonItem(a) && !isBrokenAnime(a)) {
            usedIds.add(idStr);
            mostWatched.push(a);
            if (mostWatched.length >= 12) break;
          }
        }
      }
      setMostWatchedAnime(mostWatched);

      // 6. 🆕 New Anime Arrivals (Up to 12 unique items)
      const newArrivals: Anime[] = [];
      for (const a of rawRecentList) {
        const idStr = String(a.id);
        if (!usedIds.has(idStr) && !isCartoonItem(a)) {
          usedIds.add(idStr);
          newArrivals.push(a);
          if (newArrivals.length >= 12) break;
        }
      }
      if (newArrivals.length < 10) {
        for (const c of COMPREHENSIVE_ANIME_CATALOG) {
          const a = mapAnime(c);
          const idStr = String(a.id);
          if (!usedIds.has(idStr) && !isCartoonItem(a) && !isBrokenAnime(a)) {
            usedIds.add(idStr);
            newArrivals.push(a);
            if (newArrivals.length >= 12) break;
          }
        }
      }
      setNewArrivalsAnime(newArrivals);

      // 7. 📺 Latest Episodes (Up to 12 unique non-movie series)
      const latestEpisodes: Anime[] = [];
      for (const a of rawUpdatedList) {
        const idStr = String(a.id);
        if (!usedIds.has(idStr) && !isStrictMovie(a) && !isCartoonItem(a)) {
          usedIds.add(idStr);
          latestEpisodes.push(a);
          if (latestEpisodes.length >= 12) break;
        }
      }
      if (latestEpisodes.length < 10) {
        for (const c of COMPREHENSIVE_ANIME_CATALOG) {
          const a = mapAnime(c);
          const idStr = String(a.id);
          if (!usedIds.has(idStr) && !isStrictMovie(a) && !isCartoonItem(a) && !isBrokenAnime(a)) {
            usedIds.add(idStr);
            latestEpisodes.push(a);
            if (latestEpisodes.length >= 12) break;
          }
        }
      }
      setLatestEpisodesAnime(latestEpisodes);

      // 8. 🎬 Latest Anime Movies (Up to 12 unique movies)
      const latestMovies: Anime[] = [];
      for (const a of rawMoviesList) {
        const idStr = String(a.id);
        if (!usedIds.has(idStr) && isStrictMovie(a) && !isCartoonItem(a)) {
          usedIds.add(idStr);
          latestMovies.push(a);
          if (latestMovies.length >= 12) break;
        }
      }
      if (latestMovies.length < 10) {
        for (const c of COMPREHENSIVE_ANIME_CATALOG) {
          const a = mapAnime(c);
          const idStr = String(a.id);
          if (!usedIds.has(idStr) && isStrictMovie(a) && !isCartoonItem(a) && !isBrokenAnime(a)) {
            usedIds.add(idStr);
            latestMovies.push(a);
            if (latestMovies.length >= 12) break;
          }
        }
      }
      setLatestMoviesAnime(latestMovies);

      // 9. ⭐ Trending Anime (Up to 12 unique trending anime)
      const trendingSec: Anime[] = [];
      for (const a of rawTrendingList) {
        const idStr = String(a.id);
        if (!usedIds.has(idStr) && !isCartoonItem(a)) {
          usedIds.add(idStr);
          trendingSec.push(a);
          if (trendingSec.length >= 12) break;
        }
      }
      if (trendingSec.length < 10) {
        for (const c of COMPREHENSIVE_ANIME_CATALOG) {
          const a = mapAnime(c);
          const idStr = String(a.id);
          if (!usedIds.has(idStr) && !isCartoonItem(a) && !isBrokenAnime(a)) {
            usedIds.add(idStr);
            trendingSec.push(a);
            if (trendingSec.length >= 12) break;
          }
        }
      }
      setTrendingAnime(trendingSec);

    } catch (e) {
      console.error("Failed to load home data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHomeData();

    const handleUpdate = () => {
      loadHomeData();
    };
    window.addEventListener('anova_anime_updated', handleUpdate);
    window.addEventListener('anova_content_settings_changed', handleUpdate);
    return () => {
      window.removeEventListener('anova_anime_updated', handleUpdate);
      window.removeEventListener('anova_content_settings_changed', handleUpdate);
    };
  }, [loadHomeData]);

  // Asynchronously query live API and providers when a letter or search keyword is activated
  useEffect(() => {
    const activeQuery = (selectedLetter === '#' ? '0' : selectedLetter) || azSearchQuery.trim();
    if (!activeQuery) {
      setLiveAzResults([]);
      setAzLoading(false);
      return;
    }

    let isMounted = true;
    setAzLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.search(activeQuery, 1, {});
        if (isMounted && res && Array.isArray(res.data)) {
          const mapped = res.data.map(mapAnime).filter(a => !isBrokenAnime(a));
          setLiveAzResults(mapped);
        }
      } catch (err) {
        console.error("Live A-Z search failed:", err);
      } finally {
        if (isMounted) setAzLoading(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [selectedLetter, azSearchQuery]);

  // Filter anime for the Quick A to Z Navigation
  const filteredLetterAnime = useMemo(() => {
    if (!selectedLetter && !azSearchQuery.trim()) {
      return [];
    }

    // Merge base pre-loaded catalog and dynamic live search results
    const combined = [...allCatalogAnime, ...liveAzResults];
    let results = combined;

    if (selectedLetter) {
      if (selectedLetter === '#') {
        results = results.filter(a => {
          const t = (a.title || '').trim();
          return !/^[a-zA-Z]/i.test(t);
        });
      } else {
        const targetLetter = selectedLetter.toUpperCase();
        results = results.filter(a => {
          const t = (a.title || '').trim().toUpperCase();
          return t.startsWith(targetLetter) || t.includes(targetLetter);
        });
      }
    }

    if (azSearchQuery.trim()) {
      const q = azSearchQuery.trim().toLowerCase();
      results = results.filter(a => {
        const t = (a.title || '').toLowerCase();
        return t.includes(q);
      });
    }

    // Deduplicate and ensure pristine poster
    const unique = Array.from(new Map(results.map(a => [
      String(a.id), 
      {
        ...a,
        poster: sanitizePosterUrl(a.poster, a.title, a.id)
      }
    ])).values());

    return unique;
  }, [selectedLetter, azSearchQuery, allCatalogAnime, liveAzResults]);

  const handleLetterClick = (letter: string) => {
    if (selectedLetter === letter) {
      setSelectedLetter(null);
    } else {
      setSelectedLetter(letter);
      setAzSearchQuery('');
      setTimeout(() => {
        if (letterResultsRef.current) {
          letterResultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  };

  if (loading && trendingHero.length === 0) {
    return (
      <div className="pb-24 min-h-screen bg-[#0a0a12]">
        <HeroBannerSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-20 min-h-screen bg-[#0a0a12]">
      {/* Hero Spotlight Banner */}
      <HeroBanner trending={trendingHero} />
      
      {/* Main Home Sections Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 mt-6 relative z-10">
        
        {/* CONTINUE WATCHING (if user has active history) */}
        {continueWatchingList.length > 0 && (
          <div className="py-4 border-b border-blue-500/20">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2 uppercase">
                <RotateCcw size={16} className="text-[#00d2ff]" />
                <span>Continue Watching</span>
              </h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {continueWatchingList.map((item: any) => (
                <Link 
                  key={item.animeId} 
                  to={`/watch/${item.animeId}?ep=${item.episode}`}
                  onTouchStart={handleCwTouchStart}
                  onTouchMove={handleCwTouchMove}
                  onClick={handleCwClick}
                  className="flex gap-3.5 bg-[#0d1630] p-2.5 rounded-2xl border border-blue-500/20 hover:border-[#00d2ff]/60 hover:shadow-[0_0_20px_rgba(0,210,255,0.35)] transition-all duration-300 group touch-action-manipulation shadow-md"
                >
                  <div className="w-16 h-20 relative overflow-hidden rounded-xl shrink-0 bg-[#060a14]">
                    <img 
                      src={sanitizePosterUrl(item.animePoster, item.animeTitle, item.animeId)} 
                      alt={item.animeTitle} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play fill="white" size={14} className="text-white" />
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                      <h3 className="font-semibold text-xs sm:text-sm text-white line-clamp-1 group-hover:text-[#00d2ff] transition-colors">{item.animeTitle}</h3>
                      <p className="text-[11px] text-zinc-400 mt-0.5">Episode {item.episode}</p>
                    </div>
                    <div className="w-full bg-[#060a14] rounded-full h-1">
                      <div 
                        className="bg-gradient-to-r from-[#0066ff] to-[#00d2ff] h-1 rounded-full shadow-[0_0_8px_#00d2ff]" 
                        style={{ width: item.duration > 0 ? `${(item.time / item.duration) * 100}%` : '40%' }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 1. 🏆 TOP 10 TODAY */}
        <Top10Ranked animes={top10Anime} />

        {/* 2. 🎨 Just In Cartoons (Strictly Cartoons) */}
        <HomeSectionRow
          id="just-in-cartoons"
          title="🎨 Just In Cartoons"
          link="/search?genre=Cartoon"
          items={justInCartoonsAnime}
          loading={loading}
        />

        {/* 3. 🌟 Must Watch Anime */}
        <HomeSectionRow
          id="must-watch-anime"
          title="🌟 Must Watch Anime"
          link="/search?sort=popularity"
          items={mustWatchAnime}
          loading={loading}
        />

        {/* 4. 🍿 Must Watch Anime Films */}
        <HomeSectionRow
          id="must-watch-films"
          title="🍿 Must Watch Anime Films"
          link="/search?type=MOVIE&sort=popularity"
          items={mustWatchFilmsAnime}
          loading={loading}
        />

        {/* 5. 🔥 Most Watched Anime */}
        <HomeSectionRow
          id="most-watched"
          title="🔥 Most Watched Anime"
          link="/search?sort=popularity"
          items={mostWatchedAnime}
          loading={loading}
        />

        {/* 6. 🆕 New Anime Arrivals */}
        <HomeSectionRow
          id="new-arrivals"
          title="🆕 New Anime Arrivals"
          link="/search?sort=latest"
          items={newArrivalsAnime}
          loading={loading}
        />

        {/* 7. 📺 Latest Episodes */}
        <HomeSectionRow
          id="latest-episodes"
          title="📺 Latest Episodes"
          link="/search?sort=latest"
          items={latestEpisodesAnime}
          loading={loading}
        />

        {/* 8. 🎬 Latest Anime Movies */}
        <HomeSectionRow
          id="latest-movies"
          title="🎬 Latest Anime Movies"
          link="/search?type=MOVIE"
          items={latestMoviesAnime}
          loading={loading}
        />

        {/* 9. ⭐ Trending Anime */}
        <HomeSectionRow
          id="trending-anime"
          title="⭐ Trending Anime"
          link="/search?sort=popularity"
          items={trendingAnime}
          loading={loading}
        />

        {/* ========================================================================= */}
        {/* QUICK A TO Z NAVIGATION (Reference Image Exact Match) */}
        {/* ========================================================================= */}
        <div className="pt-8 pb-10 border-t border-blue-500/20">
          <div className="text-center max-w-2xl mx-auto mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              <Sparkles size={20} className="text-[#00d2ff]" />
              <span>Quick A to Z Navigation</span>
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Select any letter to instantly filter anime titles or search alphabetically
            </p>
          </div>

          {/* Quick Search Input Box */}
          <div className="max-w-md mx-auto mb-6 relative">
            <div className="relative flex items-center">
              <SearchIcon size={16} className="absolute left-4 text-[#00d2ff]/80 pointer-events-none" />
              <input
                type="text"
                value={azSearchQuery}
                onChange={(e) => {
                  setAzSearchQuery(e.target.value);
                  if (e.target.value.trim() && selectedLetter) {
                    setSelectedLetter(null);
                  }
                }}
                placeholder="Search anime title or letter..."
                className="w-full bg-[#0d1630] border border-blue-500/30 rounded-xl pl-11 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00d2ff] focus:ring-1 focus:ring-[#00d2ff] shadow-inner transition-all"
              />
              {azSearchQuery && (
                <button 
                  onClick={() => setAzSearchQuery('')}
                  className="absolute right-3 text-zinc-400 hover:text-white p-1"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Alphabet Letter Grid */}
          <div className="grid grid-cols-7 sm:grid-cols-9 md:grid-cols-14 gap-2 sm:gap-2.5 max-w-4xl mx-auto px-2">
            {ALPHABET_LIST.map((letter) => {
              const isSelected = selectedLetter === letter;
              return (
                <button
                  key={letter}
                  onClick={() => handleLetterClick(letter)}
                  className={`py-3 sm:py-3.5 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center transition-all duration-200 cursor-pointer shadow-md ${
                    isSelected
                      ? 'bg-[#00d2ff] text-[#060a14] font-black shadow-[0_0_20px_rgba(0,210,255,0.7)] scale-105 ring-2 ring-white/50'
                      : 'bg-[#0d1630] hover:bg-[#162344] text-zinc-200 hover:text-white border border-blue-500/25 hover:border-[#00d2ff]/60 hover:shadow-[0_0_12px_rgba(0,210,255,0.3)] active:scale-95'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>

          {/* Instant A-Z Results Display */}
          {(selectedLetter || azSearchQuery.trim()) && (
            <div ref={letterResultsRef} className="mt-8 bg-[#091124] border border-blue-500/30 rounded-2xl p-4 sm:p-6 shadow-[0_0_30px_rgba(0,102,255,0.15)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-blue-500/20 mb-5">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-[#00d2ff] text-[#060a14] font-black text-base flex items-center justify-center shadow-[0_0_12px_#00d2ff]">
                    {selectedLetter || azSearchQuery.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{selectedLetter ? `Anime starting with "${selectedLetter}"` : `Results for "${azSearchQuery}"`}</span>
                      {azLoading && <Loader2 size={14} className="animate-spin text-[#00d2ff]" />}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {filteredLetterAnime.length} title{filteredLetterAnime.length !== 1 ? 's' : ''} found
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => {
                      const queryParam = selectedLetter ? (selectedLetter === '#' ? '0' : selectedLetter) : azSearchQuery;
                      navigate(`/search?q=${encodeURIComponent(queryParam)}`);
                    }}
                    className="text-xs bg-[#0066ff] hover:bg-[#0052cc] text-white font-semibold px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>View in Full Search</span>
                    <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedLetter(null);
                      setAzSearchQuery('');
                    }}
                    className="text-xs text-zinc-400 hover:text-white px-2 py-1.5 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {filteredLetterAnime.length === 0 ? (
                <div className="py-10 text-center text-zinc-400 text-sm">
                  {azLoading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={24} className="animate-spin text-[#00d2ff]" />
                      <span>Searching anime database...</span>
                    </div>
                  ) : (
                    <>
                      No anime found starting with <strong className="text-white">"{selectedLetter || azSearchQuery}"</strong> in the immediate catalog.
                      <div className="mt-3">
                        <button
                          onClick={() => navigate(`/search?q=${encodeURIComponent(selectedLetter || azSearchQuery)}`)}
                          className="text-xs text-[#00d2ff] hover:underline"
                        >
                          Search the global server database for "{selectedLetter || azSearchQuery}" →
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
                  {filteredLetterAnime.slice(0, 30).map((anime) => (
                    <div key={anime.id} className="w-full">
                      <AnimeCard anime={anime} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
export default Home;
