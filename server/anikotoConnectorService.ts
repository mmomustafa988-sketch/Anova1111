import { getOrFetch } from './cache';

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

const API_BASE = 'https://anikoto-api.onrender.com';
const SITE_BASE = 'https://anikototv.to';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
  'Referer': `${SITE_BASE}/`
};

const XML_HEADERS = {
  ...HEADERS,
  'X-Requested-With': 'XMLHttpRequest'
};

function cleanPosterUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  let poster = rawUrl.trim();
  if (poster.startsWith('//')) poster = `https:${poster}`;
  else if (poster.startsWith('/')) poster = `${SITE_BASE}${poster}`;
  return poster;
}

export class AnikotoConnectorService {
  /**
   * Search anime on Anikoto
   */
  static async searchAnime(query: string): Promise<AnikotoAnimeItem[]> {
    if (!query || !query.trim()) return [];
    const cacheKey = `anikoto:search:${query.toLowerCase().trim()}`;

    return getOrFetch(cacheKey, async () => {
      try {
        const searchUrl = `${SITE_BASE}/search?keyword=${encodeURIComponent(query.trim())}`;
        const res = await fetch(searchUrl, {
          headers: HEADERS,
          signal: AbortSignal.timeout(6000)
        }).catch(() => null);

        if (!res || !res.ok) return [];
        const html = await res.text();

        const items: AnikotoAnimeItem[] = [];
        const seenSlugs = new Set<string>();

        // Regex to parse card items on Anikoto search page
        const itemRegex = /<a[^>]+href=["'](?:https?:\/\/anikototv\.to)?\/watch\/([a-zA-Z0-9_-]+)[^"']*["'][^>]*>\s*<img[^>]+src=["']([^"']+)["'][^>]+alt=["']([^"']+)["']/gi;
        let match;
        while ((match = itemRegex.exec(html)) !== null) {
          const slug = match[1];
          const poster = cleanPosterUrl(match[2]);
          const title = match[3] ? match[3].replace(/<[^>]+>/g, '').trim() : slug;

          if (slug && slug !== 'community' && !seenSlugs.has(slug)) {
            seenSlugs.add(slug);
            items.push({
              id: `anikoto-${slug}`,
              slug,
              title,
              url: `${SITE_BASE}/watch/${slug}`,
              poster,
              type: 'TV'
            });
          }
        }

        // Fallback regex if image tag came before link or secondary layout
        if (items.length === 0) {
          const fallbackRegex = /\/watch\/([a-zA-Z0-9_-]+)/gi;
          let fbMatch;
          while ((fbMatch = fallbackRegex.exec(html)) !== null) {
            const slug = fbMatch[1];
            if (slug && slug !== 'community' && !seenSlugs.has(slug)) {
              seenSlugs.add(slug);
              items.push({
                id: `anikoto-${slug}`,
                slug,
                title: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                url: `${SITE_BASE}/watch/${slug}`,
                poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
                type: 'TV'
              });
            }
          }
        }

        return items;
      } catch (err: any) {
        console.error('[AnikotoConnectorService] searchAnime error:', err.message);
        return [];
      }
    }, 15 * 60 * 1000);
  }

  /**
   * Get schedule
   */
  static async getSchedule(timeStr?: string): Promise<any[]> {
    const today = timeStr || new Date().toISOString().split('T')[0];
    const cacheKey = `anikoto:schedule:${today}`;

    return getOrFetch(cacheKey, async () => {
      try {
        const url = `${API_BASE}/schedule?time=${today}`;
        const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(5000) }).catch(() => null);
        if (!res || !res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (err: any) {
        console.error('[AnikotoConnectorService] getSchedule error:', err.message);
        return [];
      }
    }, 30 * 60 * 1000);
  }

  /**
   * Get numeric internal ID from slug
   */
  static async getPageNumericId(slug: string): Promise<string | null> {
    const cacheKey = `anikoto:pageid:${slug}`;
    return getOrFetch(cacheKey, async () => {
      try {
        const cleanSlug = slug.replace(/^anikoto-/, '');
        const url = `${API_BASE}/page?name=${encodeURIComponent(cleanSlug)}`;
        const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(5000) }).catch(() => null);
        if (!res || !res.ok) return null;
        const raw = await res.text();
        const idStr = raw.trim().replace(/^"|"$/g, '');
        return idStr || null;
      } catch (err: any) {
        console.error('[AnikotoConnectorService] getPageNumericId error:', err.message);
        return null;
      }
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Get anime detailed info
   */
  static async getAnimeDetails(slug: string): Promise<AnikotoAnimeDetails | null> {
    const cleanSlug = slug.replace(/^anikoto-/, '');
    const cacheKey = `anikoto:info:${cleanSlug}`;

    return getOrFetch(cacheKey, async () => {
      try {
        const infoUrl = `${API_BASE}/info?name=${encodeURIComponent(cleanSlug)}`;
        const res = await fetch(infoUrl, { headers: HEADERS, signal: AbortSignal.timeout(6000) }).catch(() => null);

        let infoData: any = null;
        if (res && res.ok) {
          infoData = await res.json().catch(() => null);
        }

        const numericId = await this.getPageNumericId(cleanSlug);
        const episodes = numericId ? await this.getEpisodesByNumericId(numericId) : [];

        const title = infoData?.title || cleanSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const poster = cleanPosterUrl(infoData?.poster) || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

        const details: AnikotoAnimeDetails = {
          id: `anikoto-${cleanSlug}`,
          slug: cleanSlug,
          title,
          url: `${SITE_BASE}/watch/${cleanSlug}`,
          poster,
          synopsis: infoData?.synopsis || '',
          titleJapanese: infoData?.titleJapanese || '',
          rating: infoData?.rating || '8.0',
          type: infoData?.type || 'TV',
          status: infoData?.status || 'Currently Airing',
          duration: infoData?.duration || '24 min',
          genres: Array.isArray(infoData?.genres) ? infoData.genres : ['Anime', 'Action', 'Fantasy'],
          studios: Array.isArray(infoData?.studios) ? infoData.studios : [],
          producers: Array.isArray(infoData?.producers) ? infoData.producers : [],
          episodesCount: episodes.length || (parseInt(infoData?.episodes, 10) || 12),
          episodes
        };

        return details;
      } catch (err: any) {
        console.error('[AnikotoConnectorService] getAnimeDetails error:', err.message);
        return null;
      }
    }, 30 * 60 * 1000);
  }

  /**
   * Get episode list by numeric page ID
   */
  static async getEpisodesByNumericId(numericId: string): Promise<AnikotoEpisodeItem[]> {
    const cacheKey = `anikoto:episodes:${numericId}`;

    return getOrFetch(cacheKey, async () => {
      try {
        // First try API
        const apiUrl = `${API_BASE}/episodes?id=${numericId}`;
        const res = await fetch(apiUrl, { headers: HEADERS, signal: AbortSignal.timeout(5000) }).catch(() => null);
        if (res && res.ok) {
          const arr = await res.json().catch(() => null);
          if (Array.isArray(arr) && arr.length > 0) {
            return arr.map((item: any, idx: number) => ({
              id: item.data_id || String(item.num || idx + 1),
              number: parseInt(item.num || item.slug || idx + 1, 10) || (idx + 1),
              title: item.title || `Episode ${item.num || idx + 1}`,
              dataId: item.data_id,
              slug: item.slug,
              timestamp: item.timestamp
            }));
          }
        }

        // Fallback to AJAX site endpoint
        const siteUrl = `${SITE_BASE}/ajax/episode/list/${numericId}`;
        const siteRes = await fetch(siteUrl, { headers: XML_HEADERS, signal: AbortSignal.timeout(5000) }).catch(() => null);
        if (siteRes && siteRes.ok) {
          const siteJson = await siteRes.json().catch(() => null);
          const html = siteJson?.result || '';
          if (html) {
            const epRegex = /data-id=["']([^"']+)["'][^>]*data-num=["']([^"']+)["'][^>]*>(?:<b>\d+<\/b>\s*)?<span[^>]*class=["']d-title["'][^>]*>([^<]+)<\/span>/gi;
            const items: AnikotoEpisodeItem[] = [];
            let m;
            while ((m = epRegex.exec(html)) !== null) {
              const dataId = m[1];
              const epNum = parseInt(m[2], 10) || (items.length + 1);
              const title = m[3] ? m[3].trim() : `Episode ${epNum}`;
              items.push({
                id: dataId,
                number: epNum,
                title,
                dataId
              });
            }
            if (items.length > 0) return items;
          }
        }

        return [];
      } catch (err: any) {
        console.error('[AnikotoConnectorService] getEpisodesByNumericId error:', err.message);
        return [];
      }
    }, 30 * 60 * 1000);
  }

  /**
   * Resolve playable stream embed for an episode
   */
  static async resolveStream(slug: string, epNum: number = 1): Promise<any> {
    const cleanSlug = slug.replace(/^anikoto-/, '');
    const cacheKey = `anikoto:stream:${cleanSlug}:${epNum}`;

    return getOrFetch(cacheKey, async () => {
      try {
        const numericId = await this.getPageNumericId(cleanSlug);
        if (!numericId) {
          return { success: false, error: 'Could not resolve numeric ID for anime' };
        }

        // Fetch episode list HTML from site
        const epListUrl = `${SITE_BASE}/ajax/episode/list/${numericId}`;
        const epRes = await fetch(epListUrl, { headers: XML_HEADERS, signal: AbortSignal.timeout(5000) }).catch(() => null);
        if (!epRes || !epRes.ok) {
          return { success: false, error: 'Failed to fetch episode list' };
        }

        const epJson = await epRes.json().catch(() => null);
        const epHtml = epJson?.result || '';

        // Extract data-ids for target epNum
        const epMatchRegex = new RegExp(`data-num=["']${epNum}["'][^>]*data-ids=["']([^"']+)["']`, 'i');
        let m = epHtml.match(epMatchRegex);
        if (!m) {
          m = epHtml.match(/data-ids=["']([^"']+)["']/i);
        }

        if (!m || !m[1]) {
          return { success: false, error: `No server data found for episode ${epNum}` };
        }

        const dataIds = m[1];

        // Fetch server list HTML
        const serverListUrl = `${SITE_BASE}/ajax/server/list?servers=${encodeURIComponent(dataIds)}`;
        const serverRes = await fetch(serverListUrl, { headers: XML_HEADERS, signal: AbortSignal.timeout(5000) }).catch(() => null);
        if (!serverRes || !serverRes.ok) {
          return { success: false, error: 'Failed to fetch server list' };
        }

        const serverJson = await serverRes.json().catch(() => null);
        const serverHtml = serverJson?.result || '';

        // Extract all server items with data-link-id and server name
        const serverItemRegex = /<li[^>]*data-link-id=["']([^"']+)["'][^>]*>([^<]+)<\/li>/gi;
        const serverTasks: { linkId: string; rawName: string }[] = [];
        let sMatch;
        while ((sMatch = serverItemRegex.exec(serverHtml)) !== null) {
          serverTasks.push({ linkId: sMatch[1], rawName: sMatch[2].trim() });
        }

        if (serverTasks.length === 0) {
          // Fallback regex for link-id only
          const linkIdMatches = [...serverHtml.matchAll(/data-link-id=["']([^"']+)["']/gi)];
          for (const lm of linkIdMatches) {
            if (lm[1]) serverTasks.push({ linkId: lm[1], rawName: 'HD Stream' });
          }
        }

        if (serverTasks.length === 0) {
          return { success: false, error: 'No streaming servers found for this episode' };
        }

        // Fetch direct embed URLs in parallel
        const resolvedDetails = await Promise.all(
          serverTasks.map(async (task) => {
            try {
              const sUrl = `${SITE_BASE}/ajax/server?get=${encodeURIComponent(task.linkId)}`;
              const sRes = await fetch(sUrl, { headers: XML_HEADERS, signal: AbortSignal.timeout(4000) }).catch(() => null);
              if (sRes && sRes.ok) {
                const sJson = await sRes.json().catch(() => null);
                const embedUrl = sJson?.result?.url || sJson?.url || '';
                if (embedUrl && !embedUrl.includes('youtube.com')) {
                  return {
                    url: embedUrl,
                    name: task.rawName || 'MegaCloud',
                    language: 'Japanese (Sub)',
                    label: task.rawName || 'HD Stream'
                  };
                }
              }
            } catch (_) {}
            return null;
          })
        );

        const validServers = resolvedDetails.filter((s): s is { url: string; name: string; language: string; label: string } => s !== null && !!s.url);

        if (validServers.length > 0) {
          return {
            success: true,
            embedUrl: validServers[0].url,
            servers: validServers.map(s => s.url),
            serverDetails: validServers
          };
        }

        return { success: false, error: 'Could not resolve playable embed URL' };
      } catch (err: any) {
        console.error('[AnikotoConnectorService] resolveStream error:', err.message);
        return { success: false, error: err.message };
      }
    }, 20 * 60 * 1000);
  }

  /**
   * Get Home feed
   */
  static async getHome(): Promise<AnikotoHomeData> {
    const cacheKey = 'anikoto:home';

    return getOrFetch(cacheKey, async () => {
      try {
        const schedule = await this.getSchedule();
        const searchResults = await this.searchAnime('one piece').catch(() => []);
        const popularResults = await this.searchAnime('solo leveling').catch(() => []);
        const latestResults = await this.searchAnime('jujutsu kaisen').catch(() => []);

        return {
          trending: searchResults.slice(0, 10),
          latest: latestResults.slice(0, 10),
          popular: popularResults.slice(0, 10),
          schedule
        };
      } catch (err: any) {
        console.error('[AnikotoConnectorService] getHome error:', err.message);
        return {
          trending: [],
          latest: [],
          popular: [],
          schedule: []
        };
      }
    }, 20 * 60 * 1000);
  }
}
