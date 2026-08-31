import { getOrFetch } from './cache.js';

export interface MovieBoxItem {
  id: string;
  subjectId?: string;
  title: string;
  url: string;
  poster: string;
  type?: string;
  episodesCount?: number;
  rating?: string;
  year?: string;
  genres?: string[];
  description?: string;
}

export interface MovieBoxHomeData {
  trending: MovieBoxItem[];
  latest: MovieBoxItem[];
  popular: MovieBoxItem[];
  movies: MovieBoxItem[];
  recentlyUpdated: MovieBoxItem[];
  categories: string[];
  genres: string[];
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Origin': 'https://themoviebox.xyz',
  'Content-Type': 'application/json'
};

function formatMovieBoxItem(item: any): MovieBoxItem {
  const sId = String(item.subjectId || item.id || '');
  const posterUrl = item.cover?.url || item.cover || item.poster || item.img || '';
  const releaseYear = item.releaseDate ? String(item.releaseDate).slice(0, 4) : (item.year || '');
  const isSeries = item.subjectType === 2 || item.type === 'TV' || item.type === 'series';
  const itemType = isSeries ? 'TV' : 'Movie';

  const cleanId = sId.replace(/^moviebox-/, '');
  const detailPath = item.detailPath || item.slug || '';
  const watchUrl = detailPath 
    ? `https://themoviebox.xyz/movies/${detailPath}?id=${cleanId}`
    : `https://themoviebox.xyz/movies/${cleanId}?id=${cleanId}`;

  return {
    id: sId.startsWith('moviebox-') ? sId : `moviebox-${sId}`,
    subjectId: cleanId,
    title: item.title || item.name || `MovieBox Title ${cleanId}`,
    url: watchUrl,
    poster: posterUrl,
    type: itemType,
    episodesCount: item.episodeCount || (isSeries ? 12 : 1),
    rating: item.score ? String(item.score) : '8.8',
    year: releaseYear,
    genres: item.genre ? item.genre.split(',').map((g: string) => g.trim()) : (item.genres || [itemType]),
    description: item.description || item.describe || `Watch ${item.title || 'this content'} on MovieBox in high definition.`
  };
}

export class MovieBoxConnectorService {
  /**
   * Get home layout data from MovieBox (Trending, Latest, Movies, TV Shows)
   */
  static async getHome(): Promise<MovieBoxHomeData> {
    const emptyHome: MovieBoxHomeData = {
      trending: [],
      latest: [],
      popular: [],
      movies: [],
      recentlyUpdated: [],
      categories: ['Movies', 'TV Shows'],
      genres: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Thriller']
    };

    return getOrFetch<MovieBoxHomeData>('moviebox:home_data', async () => {
      const itemsMap = new Map<string, MovieBoxItem>();

      // 1. Fetch Trending items
      try {
        const trendRes = await fetch('https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/trending?page=1&perPage=30', {
          headers: HEADERS,
          signal: AbortSignal.timeout(6000)
        });
        if (trendRes.ok) {
          const tJson = await trendRes.json();
          const list = tJson.data?.subjectList || tJson.data?.items;
          if (tJson.code === 0 && Array.isArray(list)) {
            list.forEach(i => {
              const formatted = formatMovieBoxItem(i);
              if (formatted.subjectId) itemsMap.set(formatted.subjectId, formatted);
            });
          }
        }
      } catch (e: any) {
        console.warn('[MovieBoxConnectorService] Trending fetch warning:', e?.message || e);
      }

      // 2. Fetch Popular Movies (Filter subjectType = 1)
      try {
        const movieRes = await fetch('https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/filter', {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({ page: 1, perPage: 30, subjectType: 1 }),
          signal: AbortSignal.timeout(6000)
        });
        if (movieRes.ok) {
          const mJson = await movieRes.json();
          const list = mJson.data?.items || mJson.data?.subjectList;
          if (mJson.code === 0 && Array.isArray(list)) {
            list.forEach(i => {
              const formatted = formatMovieBoxItem(i);
              if (formatted.subjectId) itemsMap.set(formatted.subjectId, formatted);
            });
          }
        }
      } catch (e: any) {
        console.warn('[MovieBoxConnectorService] Movie filter fetch warning:', e?.message || e);
      }

      // 3. Fetch Popular TV Shows (Filter subjectType = 2)
      try {
        const tvRes = await fetch('https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/filter', {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({ page: 1, perPage: 30, subjectType: 2 }),
          signal: AbortSignal.timeout(6000)
        });
        if (tvRes.ok) {
          const tvJson = await tvRes.json();
          const list = tvJson.data?.items || tvJson.data?.subjectList;
          if (tvJson.code === 0 && Array.isArray(list)) {
            list.forEach(i => {
              const formatted = formatMovieBoxItem(i);
              if (formatted.subjectId) itemsMap.set(formatted.subjectId, formatted);
            });
          }
        }
      } catch (e: any) {
        console.warn('[MovieBoxConnectorService] TV filter fetch warning:', e?.message || e);
      }

      const allItems = Array.from(itemsMap.values());
      if (allItems.length === 0) return emptyHome;

      const moviesList = allItems.filter(i => i.type === 'Movie');
      const tvList = allItems.filter(i => i.type === 'TV');

      return {
        trending: allItems.slice(0, 15),
        latest: allItems.slice(5, 20),
        popular: allItems.slice(2, 18),
        movies: moviesList.length > 0 ? moviesList : allItems,
        recentlyUpdated: tvList.length > 0 ? tvList : allItems,
        categories: ['Movies', 'TV Shows'],
        genres: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Thriller']
      };
    }, 1800).catch(() => emptyHome);
  }

  /**
   * Search MovieBox
   */
  static async searchAnime(query: string, page: number = 1): Promise<MovieBoxItem[]> {
    if (!query || !query.trim()) return [];

    return getOrFetch<MovieBoxItem[]>(`moviebox:search:${query.toLowerCase()}:${page}`, async () => {
      try {
        const searchRes = await fetch('https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/search', {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({ keyword: query.trim(), page, perPage: 24 }),
          signal: AbortSignal.timeout(6000)
        });
        if (searchRes.ok) {
          const sJson = await searchRes.json();
          const list = sJson.data?.subjectList || sJson.data?.items || [];
          if (sJson.code === 0 && Array.isArray(list)) {
            return list.map(formatMovieBoxItem);
          }
        }
      } catch (e: any) {
        console.warn('[MovieBoxConnectorService] Search fetch error:', e?.message || e);
      }
      return [];
    }, 600).catch(() => []);
  }

  /**
   * Get single MovieBox detail
   */
  static async getAnimeDetails(subjectId: string): Promise<any> {
    const cleanId = subjectId.replace(/^moviebox-/, '');
    return getOrFetch<any>(`moviebox:details:${cleanId}`, async () => {
      try {
        const res = await fetch(`https://themoviebox.xyz/bff/v1/detail/subject?subjectId=${cleanId}&lang=en`, {
          headers: HEADERS,
          signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
          const data = await res.json();
          const bSub = data.data?.subject || data.data;
          if (bSub) {
            const formatted = formatMovieBoxItem(bSub);
            return {
              ...formatted,
              description: bSub.description || bSub.describe || formatted.description,
              seasons: bSub.seasons || [],
              episodes: bSub.episodes || []
            };
          }
        }
      } catch (e: any) {
        console.warn('[MovieBoxConnectorService] Details fetch error:', e?.message || e);
      }
      return null;
    }, 3600).catch(() => null);
  }
}
