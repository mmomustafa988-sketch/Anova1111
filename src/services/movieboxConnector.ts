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

const clientCache = new Map<string, { data: any; timestamp: number }>();
const CLIENT_TTL_MS = 10 * 60 * 1000;

async function fetchFromApi<T>(endpoint: string, fallback: T): Promise<T> {
  const cached = clientCache.get(endpoint);
  if (cached && Date.now() - cached.timestamp < CLIENT_TTL_MS) {
    return cached.data as T;
  }

  try {
    const response = await fetch(endpoint);
    if (!response.ok) return fallback;
    const result = await response.json();
    if (result && result.success && result.data !== undefined) {
      clientCache.set(endpoint, { data: result.data, timestamp: Date.now() });
      return result.data as T;
    }
    return fallback;
  } catch (_: any) {
    return fallback;
  }
}

export class MovieBoxConnector {
  /**
   * Search MovieBox catalog
   */
  static async searchAnime(query: string, page: number = 1): Promise<MovieBoxItem[]> {
    if (!query || !query.trim()) return [];
    return fetchFromApi<MovieBoxItem[]>(
      `/api/moviebox/search?q=${encodeURIComponent(query)}&page=${page}`,
      []
    );
  }

  /**
   * Get MovieBox home page catalog (trending, popular, movies, latest)
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
    return fetchFromApi<MovieBoxHomeData>('/api/moviebox/home', emptyHome);
  }

  /**
   * Get single MovieBox detail
   */
  static async getAnimeDetails(animeIdOrUrl: string): Promise<any> {
    if (!animeIdOrUrl) return null;
    return fetchFromApi<any>(
      `/api/moviebox/anime?id=${encodeURIComponent(animeIdOrUrl)}`,
      null
    );
  }
}

export default MovieBoxConnector;
