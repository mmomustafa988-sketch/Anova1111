/**
 * ToonStream Playback Connector Service
 * Dedicated connector responsible for retrieving structured playback source data from ToonStream.
 */

export interface ToonStreamPlaybackSource {
  providerName: string;
  embedUrl: string;
  language: string; // e.g. 'Japanese', 'English Dub', 'Hindi Dub', 'Bangla Dub', 'Tamil Dub', 'Telugu Dub', 'Dual Audio'
  priority: number;
  status: 'working' | 'degraded' | 'expired' | 'invalid';
  metadata: {
    headers?: Record<string, string>;
    referer?: string;
    requiresProxy?: boolean;
    redirectChain?: string[];
    httpStatus?: number;
    token?: string;
  };
}

export interface ToonStreamEpisodePlaybackData {
  episodeId: string;
  episodeUrl: string;
  episodeNumber?: number;
  animeTitle?: string;
  episodeTitle?: string;
  availableLanguages: string[];
  sources: ToonStreamPlaybackSource[];
}

const playbackCache = new Map<string, { data: ToonStreamEpisodePlaybackData; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class ToonStreamPlaybackConnector {
  /**
   * Retrieve structured episode playback sources from ToonStream
   */
  static async getEpisodePlaybackData(episodeIdOrUrl: string): Promise<ToonStreamEpisodePlaybackData | null> {
    if (!episodeIdOrUrl) return null;

    const cacheKey = `playback_${episodeIdOrUrl}`;
    const cached = playbackCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const response = await fetch(`/api/toonstream/playback?id=${encodeURIComponent(episodeIdOrUrl)}`);
      if (!response.ok) {
        console.warn(`[ToonStreamPlaybackConnector] HTTP error ${response.status} when fetching playback data`);
        return null;
      }

      const json = await response.json();
      if (json && json.success && json.data) {
        playbackCache.set(cacheKey, { data: json.data, timestamp: Date.now() });
        return json.data as ToonStreamEpisodePlaybackData;
      }
      return null;
    } catch (err: any) {
      console.error('[ToonStreamPlaybackConnector] Error getting episode playback data:', err?.message || err);
      return null;
    }
  }

  /**
   * Helper to retrieve validated working sources for a specific language
   */
  static async getWorkingSourcesForLanguage(episodeIdOrUrl: string, language: string): Promise<ToonStreamPlaybackSource[]> {
    const data = await this.getEpisodePlaybackData(episodeIdOrUrl);
    if (!data || !Array.isArray(data.sources)) return [];

    const working = data.sources.filter(s => s.status === 'working' || s.status === 'degraded');
    if (!language) return working;

    const matched = working.filter(s => s.language.toLowerCase() === language.toLowerCase());
    return matched.length > 0 ? matched : working;
  }
}

export default ToonStreamPlaybackConnector;
