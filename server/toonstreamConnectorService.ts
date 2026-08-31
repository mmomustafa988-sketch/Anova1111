import { getOrFetch } from './cache';

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

const BASE_URL = 'https://toonstream.one';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
  'Referer': `${BASE_URL}/home`
};

/**
 * Safely fetches an HTML page or JSON from ToonStream with timeout and error handling.
 */
async function fetchPage(url: string, timeoutMs: number = 6000): Promise<string | null> {
  try {
    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    const res = await fetch(fullUrl, {
      headers: HEADERS,
      signal: AbortSignal.timeout(timeoutMs)
    }).catch(() => null);

    if (res && res.ok) {
      return await res.text();
    }
    return null;
  } catch (err: any) {
    console.warn(`[ToonStreamConnector] Fetch failed for ${url}:`, err.message);
    return null;
  }
}

function cleanPosterUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let poster = rawUrl.trim();
  if (poster.startsWith('//')) poster = `https:${poster}`;
  else if (poster.startsWith('/')) poster = `${BASE_URL}${poster}`;

  const lower = poster.toLowerCase();
  if (
    lower.includes('/st.png') ||
    lower.includes('/st.jpg') ||
    lower.includes('/st.webp') ||
    lower.includes('st-logo') ||
    lower.includes('toonstream-logo') ||
    lower.includes('/logo.png') ||
    lower.includes('cropped-') ||
    lower.includes('favicon') ||
    lower.startsWith('data:image')
  ) {
    return '';
  }
  return poster;
}

/**
 * Extract anime cards from ToonStream HTML pages
 */
function parseAnimeCardsFromHtml(html: string): ToonStreamAnimeItem[] {
  if (!html) return [];
  const items: ToonStreamAnimeItem[] = [];
  const seenUrls = new Set<string>();

  // Regex patterns to capture article/div cards on ToonStream / Dooplay / WP themes
  const cardRegex = /<article[^>]*>([\s\S]*?)<\/article>|<div[^>]+class=["'][^"']*(?:item|poster|post-single|card|dfx)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(html)) !== null) {
    const block = match[1] || match[2] || '';
    
    // Extract URL
    const urlMatch = block.match(/href=["']([^"']+)["']/i);
    if (!urlMatch) continue;

    let link = urlMatch[1];
    if (link.startsWith('/')) link = `${BASE_URL}${link}`;
    if (seenUrls.has(link) || link === BASE_URL || link === `${BASE_URL}/` || link === `${BASE_URL}/home`) continue;
    
    // Skip category/genre/nav links
    if (link.includes('/category/') || link.includes('/genre/') || link.includes('/public/')) continue;

    // Extract Title
    const titleMatch = block.match(/alt=["']([^"']+)["']/i) ||
                       block.match(/title=["']([^"']+)["']/i) ||
                       block.match(/class=["'][^"']*(?:title|entry-title|name)[^"']*["'][^>]*>([^<]+)/i);
    let title = titleMatch ? titleMatch[1].trim() : '';
    if (!title || title.includes('${') || title.toLowerCase() === 'index background' || title.toLowerCase() === 'toonstream logo') continue;

    seenUrls.add(link);

    // Extract Poster Image: Prefer data-src / data-lazy-src over src (which often points to st.png)
    const dataImgMatch = block.match(/(?:data-src|data-lazy-src|data-original|data-post-image)=["']([^"']+\.(?:png|jpg|jpeg|webp)[^"']*)["']/i);
    const srcImgMatch = block.match(/(?:class=["'][^"']*poster[^"']*["'][^>]*src=["']|src=["'])([^"']+\.(?:png|jpg|jpeg|webp)[^"']*)["']/i);

    let poster = cleanPosterUrl(dataImgMatch ? dataImgMatch[1] : '');
    if (!poster) {
      poster = cleanPosterUrl(srcImgMatch ? srcImgMatch[1] : '');
    }

    // Extract Type
    const typeMatch = block.match(/class=["'][^"']*(?:quality|type|category)[^"']*["'][^>]*>([^<]+)/i);
    let type = typeMatch ? typeMatch[1].trim() : undefined;
    if (!type) {
      if (link.includes('/movies/') || link.includes('/movie/')) type = 'Movie';
      else if (link.includes('/series/')) type = 'TV';
      else if (link.includes('/episode/')) type = 'Episode';
      else type = 'TV';
    }

    // Extract ID from URL
    const cleanPath = link.replace(BASE_URL, '').replace(/^\/+|\/+$/g, '');
    const id = cleanPath.replace(/\//g, '-');

    items.push({
      id: id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title,
      url: link,
      poster: poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop',
      type: type || 'TV'
    });
  }

  return items;
}

export class ToonStreamConnectorService {
  /**
   * Fetch all available paginated anime pages from ToonStream
   */
  static async getAllAnimePages(maxPages: number = 150): Promise<ToonStreamAnimeItem[]> {
    const cacheKey = 'toonstream_all_anime_catalog';
    return getOrFetch<ToonStreamAnimeItem[]>(
      cacheKey,
      async () => {
        const allItems: ToonStreamAnimeItem[] = [];
        const seenUrls = new Set<string>();
        let consecutiveEmpty = 0;
        const batchSize = 5;

        for (let page = 1; page <= maxPages; page += batchSize) {
          if (consecutiveEmpty >= 3) break;

          const batchPages = Array.from({ length: batchSize }, (_, i) => page + i).filter(p => p <= maxPages);
          const pageResults = await Promise.all(
            batchPages.map(async (p) => {
              const url = p === 1 ? '/series' : `/series/page/${p}/`;
              const html = await fetchPage(url, 8000);
              if (!html) return [];
              return parseAnimeCardsFromHtml(html);
            })
          );

          let addedInBatch = 0;
          for (const items of pageResults) {
            if (items.length === 0) {
              consecutiveEmpty++;
            } else {
              consecutiveEmpty = 0;
              for (const item of items) {
                if (!seenUrls.has(item.url)) {
                  seenUrls.add(item.url);
                  allItems.push(item);
                  addedInBatch++;
                }
              }
            }
          }

          if (addedInBatch === 0 && consecutiveEmpty >= 3) {
            break;
          }
        }

        console.log(`[ToonStreamConnectorService] getAllAnimePages: Retrieved ${allItems.length} total anime across paginated pages.`);
        return allItems;
      },
      1800 // Cache catalog for 30 minutes
    );
  }

  /**
   * Fetch home page content with caching
   */
  static async getHome(): Promise<ToonStreamHomeData> {
    return getOrFetch<ToonStreamHomeData>(
      'toonstream_home',
      async () => {
        const html = await fetchPage('/home');
        if (!html) {
          return { trending: [], latest: [], popular: [], movies: [], recentlyUpdated: [], categories: [], genres: [] };
        }

        const cards = parseAnimeCardsFromHtml(html);
        const genres = Array.from(html.matchAll(/href=["']\/(?:genre|genres)\/([^"']+)\/["']/gi)).map(m => m[1]);
        const categories = Array.from(html.matchAll(/href=["']\/(?:category|type)\/([^"']+)\/["']/gi)).map(m => m[1]);

        const movies = cards.filter(c => c.type === 'Movie' || c.url.includes('/movies/'));
        const nonMovies = cards.filter(c => c.type !== 'Movie' && !c.url.includes('/movies/'));

        return {
          trending: nonMovies.slice(0, 15),
          latest: cards.slice(0, 20),
          popular: nonMovies.slice(10, 30),
          movies: movies.length > 0 ? movies : cards.slice(0, 10),
          recentlyUpdated: cards.slice(0, 20),
          categories: Array.from(new Set(categories)),
          genres: Array.from(new Set(genres))
        };
      },
      600 // Cache for 10 minutes
    );
  }

  /**
   * Get trending anime
   */
  static async getTrending(): Promise<ToonStreamAnimeItem[]> {
    const home = await this.getHome();
    return home.trending.length > 0 ? home.trending : home.popular;
  }

  /**
   * Get latest anime episodes / updates
   */
  static async getLatest(): Promise<ToonStreamAnimeItem[]> {
    const home = await this.getHome();
    return home.latest.length > 0 ? home.latest : home.recentlyUpdated;
  }

  /**
   * Get list of genres
   */
  static async getGenres(): Promise<string[]> {
    return getOrFetch<string[]>(
      'toonstream_genres',
      async () => {
        const html = await fetchPage('/genres') || await fetchPage('/');
        if (!html) return ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi', 'Slice of Life'];
        const matches = Array.from(html.matchAll(/href=["']\/(?:genre|genres)\/([^"']+)\/["']/gi)).map(m => m[1]);
        const unique = Array.from(new Set(matches)).map(g => g.charAt(0).toUpperCase() + g.slice(1));
        return unique.length > 0 ? unique : ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi', 'Slice of Life'];
      },
      86400 // Cache for 24 hours
    );
  }

  /**
   * Get list of categories / types
   */
  static async getCategories(): Promise<string[]> {
    return getOrFetch<string[]>(
      'toonstream_categories',
      async () => {
        return ['TV Series', 'Movies', 'OVA', 'ONA', 'Specials'];
      },
      86400
    );
  }

  /**
   * Search anime on ToonStream
   */
  static async searchAnime(query: string, page: number = 1): Promise<ToonStreamAnimeItem[]> {
    if (!query || !query.trim()) return [];
    const cacheKey = `toonstream_search_${encodeURIComponent(query.toLowerCase())}_p${page}`;
    return getOrFetch<ToonStreamAnimeItem[]>(
      cacheKey,
      async () => {
        try {
          const jsonStr = await fetchPage(`/search/all?q=${encodeURIComponent(query)}`);
          if (jsonStr) {
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
                return parsed.data.map((item: any) => {
                  let link = item.url || '';
                  if (link.startsWith('/')) link = `${BASE_URL}${link}`;
                  const cleanPath = link.replace(BASE_URL, '').replace(/^\/+|\/+$/g, '');
                  const id = cleanPath.replace(/\//g, '-');
                  return {
                    id: id || item.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    title: item.title,
                    url: link,
                    poster: item.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop',
                    type: item.type === 'movie' ? 'Movie' : 'TV'
                  };
                });
              }
            } catch (_) {}
          }
          // Fallback to HTML search page if JSON search didn't return results
          const html = await fetchPage(`/home?s=${encodeURIComponent(query)}`);
          if (!html) return [];
          return parseAnimeCardsFromHtml(html);
        } catch (e) {
          console.error("ToonStream search failed:", e);
          return [];
        }
      },
      600 // Cache search for 10 mins
    );
  }

  /**
   * Get details for an anime
   */
  static async getAnimeDetails(animeIdOrUrl: string): Promise<ToonStreamAnimeDetails | null> {
    const rawId = animeIdOrUrl.replace(/^https?:\/\/[^\/]+\//, '').replace(/^toonstream-/, '').replace(/^\/+|\/+$/g, '');
    const cleanId = rawId.replace(/^(series|movies|episode)-/, '$1/');
    const cacheKey = `toonstream_details_${encodeURIComponent(rawId)}`;

    return getOrFetch<ToonStreamAnimeDetails | null>(
      cacheKey,
      async () => {
        let targetUrl = animeIdOrUrl.startsWith('http') ? animeIdOrUrl : `${BASE_URL}/${cleanId}`;
        let html = await fetchPage(targetUrl);
        if (!html && !cleanId.includes('/')) {
          // Try with /series/ prefix
          targetUrl = `${BASE_URL}/series/${cleanId}`;
          html = await fetchPage(targetUrl);
        }
        if (!html && !cleanId.includes('/')) {
          // Try with /movies/ prefix
          targetUrl = `${BASE_URL}/movies/${cleanId}`;
          html = await fetchPage(targetUrl);
        }
        if (!html) return null;

        // Extract title
        const titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        const title = titleM ? titleM[1].replace(/<[^>]+>/g, '').trim() : rawId;

        // Extract poster
        const dataImgM = html.match(/(?:data-src|data-lazy-src|data-original|data-post-image)=["']([^"']+\.(?:png|jpg|jpeg|webp)[^"']*)["']/i);
        const imgM = html.match(/(?:class=["'][^"']*poster[^"']*["'][^>]*src=["']|src=["'])([^"']+\.(?:png|jpg|jpeg|webp)[^"']*)["']/i);
        let poster = cleanPosterUrl(dataImgM ? dataImgM[1] : '');
        if (!poster) {
          poster = cleanPosterUrl(imgM ? imgM[1] : '');
        }

        // Extract description
        const descM = html.match(/class=["'][^"']*(?:entry-content|wp-content|description)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
        const description = descM ? descM[1].replace(/<[^>]+>/g, '').trim() : '';

        // Extract episodes
        const episodes = await this.getEpisodes(targetUrl);

        return {
          id: rawId,
          title,
          url: targetUrl,
          poster: poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop',
          description,
          episodes,
          episodesCount: episodes.length
        };
      },
      1800 // Cache for 30 minutes
    );
  }

  /**
   * Get episode list for anime
   */
  static async getEpisodes(animeIdOrUrl: string): Promise<ToonStreamEpisodeItem[]> {
    const rawId = animeIdOrUrl.replace(/^https?:\/\/[^\/]+\//, '').replace(/^toonstream-/, '').replace(/^\/+|\/+$/g, '');
    const cleanId = rawId.replace(/^(series|movies|episode)-/, '$1/');
    const cacheKey = `toonstream_episodes_${encodeURIComponent(rawId)}`;

    return getOrFetch<ToonStreamEpisodeItem[]>(
      cacheKey,
      async () => {
        let targetUrl = animeIdOrUrl.startsWith('http') ? animeIdOrUrl : `${BASE_URL}/${cleanId}`;
        let html = await fetchPage(targetUrl);
        if (!html && !cleanId.includes('/')) {
          targetUrl = `${BASE_URL}/series/${cleanId}`;
          html = await fetchPage(targetUrl);
        }
        if (!html) return [];

        const episodes: ToonStreamEpisodeItem[] = [];
        const seenNumbers = new Set<number>();

        // Regex for episode links in HTML
        const epLinkRegex = /<a[^>]+href=["'](https?:\/\/[^"']+\/episode\/[^"']+|\/episode\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let match: RegExpExecArray | null;

        while ((match = epLinkRegex.exec(html)) !== null) {
          let link = match[1];
          const inner = match[2] || '';
          if (link.startsWith('/')) link = `${BASE_URL}${link}`;

          const numMatch = link.match(/(?:ep|-)?(\d+)x(\d+)|(?:ep|-)(\d+)(?:\/|$)|(?:Episode|Ep)\s*(\d+)/i);
          let num = episodes.length + 1;
          if (numMatch) {
            num = parseInt(numMatch[2] || numMatch[3] || numMatch[4] || numMatch[1] || `${episodes.length + 1}`, 10);
          }

          if (!seenNumbers.has(num)) {
            seenNumbers.add(num);
            episodes.push({
              id: `${rawId}-ep-${num}`,
              number: num,
              title: `Episode ${num}`,
              url: link
            });
          }
        }

        return episodes.sort((a, b) => a.number - b.number);
      },
      1800
    );
  }

  /**
   * Get specific episode details
   */
  static async getEpisodeDetails(animeIdOrUrl: string, epNum: number): Promise<ToonStreamEpisodeItem | null> {
    const eps = await this.getEpisodes(animeIdOrUrl);
    const found = eps.find(e => e.number === epNum);
    return found || null;
  }
}
