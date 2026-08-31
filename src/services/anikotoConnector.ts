/**
 * AnikotoConnector Service
 * Primary content connector for Anikoto API & web scraping synchronization
 */

export interface AnikotoAnimeItem {
  id: string;
  slug: string;
  title: string;
  url: string;
  poster: string;
  type?: string;
  episodesCount?: number;
  rating?: string;
  year?: string;
  genres?: string[];
  status?: string;
}

export interface AnikotoEpisodeItem {
  id: string;
  number: number;
  title: string;
  dataId?: string;
  slug?: string;
  timestamp?: string;
}

export interface AnikotoAnimeDetails extends AnikotoAnimeItem {
  synopsis?: string;
  titleJapanese?: string;
  duration?: string;
  episodes: AnikotoEpisodeItem[];
  studios?: string[];
  producers?: string[];
}

export interface AnikotoHomeData {
  trending: AnikotoAnimeItem[];
  latest: AnikotoAnimeItem[];
  popular: AnikotoAnimeItem[];
  schedule: any[];
}

// Client-side cache
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
      console.warn(`[AnikotoConnector] API call ${endpoint} returned status ${response.status}`);
      return fallback;
    }
    const result = await response.json();
    if (result && result.success && result.data !== undefined) {
      clientCache.set(endpoint, { data: result.data, timestamp: Date.now() });
      return result.data as T;
    }
    return fallback;
  } catch (error: any) {
    console.error(`[AnikotoConnector] Network error fetching ${endpoint}:`, error?.message || error);
    return fallback;
  }
}

export class AnikotoConnector {
  /**
   * Search anime on Anikoto
   */
  static async searchAnime(query: string): Promise<AnikotoAnimeItem[]> {
    if (!query || !query.trim()) return [];
    return fetchFromApi<AnikotoAnimeItem[]>(
      `/api/anikoto/search?q=${encodeURIComponent(query.trim())}`,
      []
    );
  }

  /**
   * Get home page layout data
   */
  static async getHome(): Promise<AnikotoHomeData> {
    const emptyHome: AnikotoHomeData = {
      trending: [],
      latest: [],
      popular: [],
      schedule: []
    };
    return fetchFromApi<AnikotoHomeData>('/api/anikoto/home', emptyHome);
  }

  /**
   * Get detailed anime information
   */
  static async getAnimeDetails(slug: string): Promise<AnikotoAnimeDetails | null> {
    const cleanSlug = slug.replace(/^anikoto-/, '');
    if (!cleanSlug) return null;
    return fetchFromApi<AnikotoAnimeDetails | null>(
      `/api/anikoto/anime?id=${encodeURIComponent(cleanSlug)}`,
      null
    );
  }

  /**
   * Get episode list
   */
  static async getEpisodes(slug: string): Promise<AnikotoEpisodeItem[]> {
    const cleanSlug = slug.replace(/^anikoto-/, '');
    if (!cleanSlug) return [];
    return fetchFromApi<AnikotoEpisodeItem[]>(
      `/api/anikoto/episodes?id=${encodeURIComponent(cleanSlug)}`,
      []
    );
  }

  /**
   * Resolve stream embed for an episode
   */
  static async resolveStream(slug: string, ep: number = 1): Promise<any> {
    const cleanSlug = slug.replace(/^anikoto-/, '');
    try {
      const res = await fetch(`/api/resolve-anikoto?slug=${encodeURIComponent(cleanSlug)}&ep=${ep}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e: any) {
      console.error('[AnikotoConnector] Error resolving stream:', e);
    }
    return { success: false, error: 'Failed resolving Anikoto stream' };
  }
}

export default AnikotoConnector;
