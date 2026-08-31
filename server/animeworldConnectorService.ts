/**
 * AnimeWorld Connector Service
 * Extracts high-speed video servers & backup streams from watchanimeworld.org
 */

import { getOrFetch } from './cache.js';

export interface AnimeWorldSource {
  providerName: string;
  embedUrl: string;
  language: string;
  priority: number;
  status: 'working' | 'degraded' | 'expired' | 'invalid';
}

const AW_BASE = 'https://watchanimeworld.org';
const AW_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': `${AW_BASE}/`,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

/**
 * Validates a video source URL to verify it's reachable and not 404/broken
 */
async function validateSourceUrl(url: string): Promise<boolean> {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();

  if (
    lower.includes('youtube.com') || lower.includes('youtu.be') ||
    lower.includes('cloudy') || lower.includes('upns') || lower.includes('gdmirror') ||
    lower.includes('about:blank') || lower.includes('error=224003') || lower.includes('error=404')
  ) {
    return false;
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: AW_HEADERS,
      signal: AbortSignal.timeout(2200)
    }).catch(() => null);

    if (!res || res.status >= 400) return false;

    const bodyText = await res.text().catch(() => '');
    const lowerText = bodyText.toLowerCase();

    if (
      lowerText.includes('404 not found') ||
      lowerText.includes('file not found') ||
      lowerText.includes('video has been deleted') ||
      lowerText.includes('this video is no longer available') ||
      lowerText.includes('file was deleted') ||
      lowerText.includes('stream not found') ||
      lowerText.includes('no video available') ||
      lowerText.includes('domain suspended') ||
      lowerText.includes('account suspended') ||
      lowerText.includes('error 102630') ||
      lowerText.includes('error 224003')
    ) {
      return false;
    }

    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Derives clean provider display name from URL
 */
function deriveProviderName(url: string, rawLabel?: string, lang?: string): string {
  const combined = `${url} ${rawLabel || ''}`.toLowerCase();

  if (combined.includes('as-cdn') || combined.includes('cdn21')) return 'AS-CDN (AnimeWorld)';
  if (combined.includes('abyss')) return 'ABYSSPLAYER (AW)';
  if (combined.includes('turbovid') || combined.includes('turbo')) return 'TURBOVID (AW)';
  if (combined.includes('vidmoly')) return 'VIDMOLY (AW)';
  if (combined.includes('rubystream') || combined.includes('rubystm')) return 'RUBYSTREAM (AW)';
  if (combined.includes('vidstreaming')) return 'VIDSTREAMING (AW)';
  if (combined.includes('strmup') || combined.includes('streamup')) return 'STRMUP (AW)';

  if (lang && lang.trim()) {
    return `AW-${lang.toUpperCase().replace(/\s+DUB/i, '')}`;
  }

  return rawLabel && rawLabel.trim() ? `${rawLabel.trim()} (AW)` : 'AnimeWorld Backup';
}

export class AnimeWorldConnectorService {
  /**
   * Fetches backup video servers for an episode from watchanimeworld.org
   */
  static async getEpisodePlaybackSources(queryOrUrl: string, epNum: number = 1): Promise<AnimeWorldSource[]> {
    const cacheKey = `animeworld_sources_${encodeURIComponent(queryOrUrl)}_${epNum}`;

    return getOrFetch<AnimeWorldSource[]>(
      cacheKey,
      async () => {
        const candidateUrls: string[] = [];

        if (queryOrUrl.startsWith('http://') || queryOrUrl.startsWith('https://')) {
          if (queryOrUrl.includes('watchanimeworld.org')) {
            candidateUrls.push(queryOrUrl);
          }
        }

        // Generate candidate AnimeWorld episode URLs
        const cleanSlug = queryOrUrl
          .toLowerCase()
          .replace(/https?:\/\/[^\/]+\//, '')
          .replace(/^(?:episode\/|anime\/)/, '')
          .replace(/\/?$/, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        if (cleanSlug) {
          candidateUrls.push(`${AW_BASE}/episode/${cleanSlug}-1x${epNum}/`);
          candidateUrls.push(`${AW_BASE}/episode/${cleanSlug}-${epNum}/`);
          candidateUrls.push(`${AW_BASE}/episode/${cleanSlug}-episode-${epNum}/`);
          candidateUrls.push(`${AW_BASE}/episode/${cleanSlug}/`);
        }

        let targetHtml = '';
        let matchedUrl = '';

        for (const candidate of candidateUrls) {
          try {
            const res = await fetch(candidate, {
              headers: AW_HEADERS,
              signal: AbortSignal.timeout(3000)
            });
            if (res.ok) {
              const html = await res.text();
              if (html && (html.includes('iframe') || html.includes('player-option') || html.includes('as-cdn'))) {
                targetHtml = html;
                matchedUrl = candidate;
                break;
              }
            }
          } catch (_) {}
        }

        if (!targetHtml) {
          return [];
        }

        const rawSources: { url: string; label?: string; lang?: string }[] = [];
        const seenUrls = new Set<string>();

        const addSource = (u: string, label?: string, lang?: string) => {
          let clean = u.trim();
          if (clean.startsWith('//')) clean = `https:${clean}`;
          if (clean.startsWith('/')) clean = `${AW_BASE}${clean}`;

          const lower = clean.toLowerCase();
          const lowerLabel = (label || '').toLowerCase();
          if (
            lower.includes('youtube.com') || lower.includes('youtu.be') ||
            lower.includes('cloudy') || lower.includes('upns') || lower.includes('gdmirror') ||
            lower.includes('sandbox') || lower.includes('broken') || lower.includes('offline') || lower.includes('dead') || lower.includes('invalid') ||
            lowerLabel.includes('sandbox') || lowerLabel.includes('broken') || lowerLabel.includes('offline') || lowerLabel.includes('dead')
          ) return;

          if (seenUrls.has(clean)) return;
          seenUrls.add(clean);
          rawSources.push({ url: clean, label, lang });
        };

        // 1. Extract direct iframes
        const iframeMatches = [...targetHtml.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)];
        for (const m of iframeMatches) {
          const iframeSrc = m[1];
          if (!iframeSrc) continue;

          if (iframeSrc.includes('data=')) {
            // Base64 player payload (contains multiple language streams)
            try {
              const urlObj = new URL(iframeSrc.startsWith('http') ? iframeSrc : `${AW_BASE}${iframeSrc}`);
              const dataParam = urlObj.searchParams.get('data');
              if (dataParam) {
                const decoded = Buffer.from(dataParam, 'base64').toString('utf-8');
                const parsed = JSON.parse(decoded);
                if (Array.isArray(parsed)) {
                  for (const item of parsed) {
                    if (item && item.link) {
                      addSource(item.link, `AnimeWorld ${item.language || ''}`, item.language);
                    }
                  }
                }
              }
            } catch (_) {}
          } else {
            addSource(iframeSrc, 'AnimeWorld Server');
          }
        }

        // 2. Validate and format all sources
        const results: AnimeWorldSource[] = [];
        let pIndex = 1;

        for (const item of rawSources) {
          const isValid = await validateSourceUrl(item.url);
          if (isValid) {
            const providerName = deriveProviderName(item.url, item.label, item.lang);
            results.push({
              providerName,
              embedUrl: item.url,
              language: item.lang || 'Japanese',
              priority: 10 + pIndex++,
              status: 'working'
            });
          }
        }

        return results;
      },
      600 // 10 minutes cache
    );
  }
}
