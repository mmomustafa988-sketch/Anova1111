/**
 * ToonStreamConnector Service
 * Primary content connector for ToonStream synchronization
 */

export interface ToonStreamAnimeItem {
  id: string;
  title: string;
  url: string;
  poster: string;
  type?: string;
  episodesCount?: number;
  rating?: string;
  year?: string;
  genres?: string[];
  dubTypes?: string[];
}

export interface ToonStreamEpisodeItem {
  id: string;
  number: number;
  title: string;
  url: string;
  thumbnail?: string;
  releaseDate?: string;
}

export interface ToonStreamAnimeDetails extends ToonStreamAnimeItem {
  description?: string;
  seasons?: { seasonNumber: number; title: string; episodes: ToonStreamEpisodeItem[] }[];
  episodes: ToonStreamEpisodeItem[];
  status?: string;
  studios?: string[];
}

export interface ToonStreamHomeData {
  trending: ToonStreamAnimeItem[];
  latest: ToonStreamAnimeItem[];
  popular: ToonStreamAnimeItem[];
  movies: ToonStreamAnimeItem[];
  recentlyUpdated: ToonStreamAnimeItem[];
  categories: string[];
  genres: string[];
}

// Client-side cache for fast instantaneous user navigation
const clientCache = new Map<string, { data: any; timestamp: number }>();
const CLIENT_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function fetchFromApi<T>(endpoint: string, fallback: T): Promise<T> {
  const cached = clientCache.get(endpoint);
  if (cached && Date.now() - cached.timestamp < CLIENT_TTL_MS) {
    return cached.data as T;
  }

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      console.warn(`[ToonStreamConnector] API call ${endpoint} returned status ${response.status}`);
      return fallback;
    }
    const result = await response.json();
    if (result && result.success && result.data !== undefined) {
      clientCache.set(endpoint, { data: result.data, timestamp: Date.now() });
      return result.data as T;
    }
    return fallback;
  } catch (error: any) {
    console.error(`[ToonStreamConnector] Network error fetching ${endpoint}:`, error?.message || error);
    return fallback;
  }
}

export class ToonStreamConnector {
  /**
   * Search anime on ToonStream
   */
  static async searchAnime(query: string, page: number = 1): Promise<ToonStreamAnimeItem[]> {
    if (!query || !query.trim()) return [];
    return fetchFromApi<ToonStreamAnimeItem[]>(
      `/api/toonstream/search?q=${encodeURIComponent(query)}&page=${page}`,
      []
    );
  }

  /**
   * Get home page layout data including sliders, trending, latest, genres, categories
   */
  static async getHome(): Promise<ToonStreamHomeData> {
    const emptyHome: ToonStreamHomeData = {
      trending: [],
      latest: [],
      popular: [],
      movies: [],
      recentlyUpdated: [],
      categories: ['TV Series', 'Movies', 'OVA', 'ONA', 'Specials'],
      genres: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi', 'Slice of Life']
    };
    return fetchFromApi<ToonStreamHomeData>('/api/toonstream/home', emptyHome);
  }

  /**
   * Get trending items from ToonStream
   */
  static async getTrending(): Promise<ToonStreamAnimeItem[]> {
    return fetchFromApi<ToonStreamAnimeItem[]>('/api/toonstream/trending', []);
  }

  /**
   * Get latest uploaded anime / episodes
   */
  static async getLatest(): Promise<ToonStreamAnimeItem[]> {
    return fetchFromApi<ToonStreamAnimeItem[]>('/api/toonstream/latest', []);
  }

  /**
   * Get full details for a specific anime
   */
  static async getAnimeDetails(animeIdOrUrl: string): Promise<ToonStreamAnimeDetails | null> {
    if (!animeIdOrUrl) return null;
    return fetchFromApi<ToonStreamAnimeDetails | null>(
      `/api/toonstream/anime?id=${encodeURIComponent(animeIdOrUrl)}`,
      null
    );
  }

  /**
   * Get episode list for an anime
   */
  static async getEpisodes(animeIdOrUrl: string): Promise<ToonStreamEpisodeItem[]> {
    if (!animeIdOrUrl) return [];
    return fetchFromApi<ToonStreamEpisodeItem[]>(
      `/api/toonstream/episodes?id=${encodeURIComponent(animeIdOrUrl)}`,
      []
    );
  }

  /**
   * Get single episode details
   */
  static async getEpisodeDetails(animeIdOrUrl: string, epNum: number): Promise<ToonStreamEpisodeItem | null> {
    if (!animeIdOrUrl || !epNum) return null;
    return fetchFromApi<ToonStreamEpisodeItem | null>(
      `/api/toonstream/episode?id=${encodeURIComponent(animeIdOrUrl)}&num=${epNum}`,
      null
    );
  }

  /**
   * Get list of genres
   */
  static async getGenres(): Promise<string[]> {
    return fetchFromApi<string[]>('/api/toonstream/genres', [
      'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi', 'Slice of Life'
    ]);
  }

  /**
   * Get list of categories
   */
  static async getCategories(): Promise<string[]> {
    return fetchFromApi<string[]>('/api/toonstream/categories', [
      'TV Series', 'Movies', 'OVA', 'ONA', 'Specials'
    ]);
  }
}

export default ToonStreamConnector;
