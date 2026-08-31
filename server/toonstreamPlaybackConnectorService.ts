import { getOrFetch } from './cache';
import { AnimeWorldConnectorService } from './animeworldConnectorService.js';

export interface ToonStreamPlaybackSource {
  providerName: string;
  embedUrl: string;
  language: string; // e.g., 'Japanese', 'English Dub', 'Hindi Dub', 'Bangla Dub', 'Tamil Dub', 'Telugu Dub', 'Dual Audio'
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

const BASE_URL = 'https://toon-stream.site';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer': `${BASE_URL}/`
};

/**
 * Dynamically derive clean Provider Name from host domain or option label
 */
function deriveProviderName(url: string, rawLabel?: string): string {
  if (rawLabel && !rawLabel.toLowerCase().includes('server') && !rawLabel.toLowerCase().includes('player') && rawLabel.trim().length > 1) {
    return rawLabel.trim();
  }
  try {
    const parsed = new URL(url.startsWith('//') ? `https:${url}` : url);
    const host = parsed.hostname.replace(/^www\./, '');
    const parts = host.split('.');
    const mainDomain = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    if (mainDomain && !mainDomain.includes('toon-stream') && !mainDomain.includes('toonstream')) {
      return mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);
    }
  } catch (_) {}
  return rawLabel || 'Default Stream';
}

/**
 * Detect language or audio dub track for a source
 */
function detectLanguageFromSource(url: string, rawLabel?: string): string {
  const combined = `${url} ${rawLabel || ''}`.toLowerCase();

  if (combined.includes('hindi') || combined.includes('hin dub') || combined.includes('hin_dub') || combined.includes('hindi_dub')) {
    return 'Hindi Dub';
  }
  if (combined.includes('bangla') || combined.includes('bengali') || combined.includes('ban dub') || combined.includes('bangla_dub')) {
    return 'Bangla Dub';
  }
  if (combined.includes('tamil') || combined.includes('tam dub') || combined.includes('tamil_dub')) {
    return 'Tamil Dub';
  }
  if (combined.includes('telugu') || combined.includes('tel dub') || combined.includes('telugu_dub')) {
    return 'Telugu Dub';
  }
  if (combined.includes('dual audio') || combined.includes('multi audio') || combined.includes('dual') || combined.includes('multi')) {
    return 'Dual Audio';
  }
  if (combined.includes('english') || combined.includes('eng dub') || combined.includes('eng_dub') || combined.includes('english_dub') || combined.includes('dubbed') || combined.includes('dub')) {
    return 'English Dub';
  }
  if (combined.includes('sub') || combined.includes('jap') || combined.includes('japanese')) {
    return 'Japanese (Sub)';
  }
  return 'English Dub';
}

/**
 * Validate source HTTP response and redirect chain
 */
async function validateSourceUrl(url: string): Promise<{
  status: 'working' | 'degraded' | 'expired' | 'invalid';
  httpStatus?: number;
  redirectChain?: string[];
  finalUrl?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const redirectChain: string[] = [url];
    let currentUrl = url;
    let res = await fetch(currentUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': `${BASE_URL}/`
      },
      signal: controller.signal
    }).catch(() => null);

    clearTimeout(timeout);

    if (!res) {
      return { status: 'degraded', httpStatus: 0, redirectChain };
    }

    if (res.url && res.url !== currentUrl) {
      redirectChain.push(res.url);
      currentUrl = res.url;
    }

    if (res.ok || res.status === 302 || res.status === 301) {
      return {
        status: 'working',
        httpStatus: res.status,
        redirectChain,
        finalUrl: currentUrl
      };
    } else if (res.status >= 400 && res.status < 500) {
      return { status: 'expired', httpStatus: res.status, redirectChain };
    } else {
      return { status: 'invalid', httpStatus: res.status, redirectChain };
    }
  } catch (_) {
    return { status: 'degraded', httpStatus: 0 };
  }
}

export class ToonStreamPlaybackConnectorService {
  /**
   * Resolves all playback sources for a given episode from ToonStream
   */
  static async getEpisodePlaybackData(episodeIdOrUrl: string): Promise<ToonStreamEpisodePlaybackData> {
    const targetUrl = episodeIdOrUrl.startsWith('http')
      ? episodeIdOrUrl
      : `${BASE_URL}/${episodeIdOrUrl.replace(/^\/+/, '')}`;

    const cacheKey = `toonstream_playback_${encodeURIComponent(targetUrl)}`;

    return getOrFetch<ToonStreamEpisodePlaybackData>(
      cacheKey,
      async () => {
        const rawSources: { url: string; rawLabel?: string }[] = [];
        const seenUrls = new Set<string>();

        const addRawSource = (u: string, label?: string) => {
          let clean = u.trim();
          if (clean.startsWith('//')) clean = `https:${clean}`;
          if (clean.startsWith('/')) clean = `${BASE_URL}${clean}`;

          const lower = clean.toLowerCase();
          const lowerLabel = (label || '').toLowerCase();
          if (
            lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('/yt/') ||
            lower.includes('gdmirror') || lower.includes('gd_mirror') || lower.includes('gd-mirror') || lower.includes('gd mirror') ||
            lower.includes('drive.google') || lower.includes('docs.google') || lower.includes('googleusercontent') || lower.includes('cloudy') || lower.includes('upns') ||
            lower.includes('sandbox') || lower.includes('broken') || lower.includes('offline') || lower.includes('dead') || lower.includes('expired') || lower.includes('invalid') ||
            lowerLabel.includes('gd mirror') || lowerLabel.includes('gdmirror') || lowerLabel.includes('gd_mirror') || lowerLabel.includes('gd-mirror') ||
            lowerLabel.includes('gd mirrorbot') || lowerLabel.includes('gdmirrorbot') || lowerLabel.includes('gdrive') || lowerLabel.includes('cloudy') || lowerLabel.includes('upns') ||
            lowerLabel.includes('sandbox') || lowerLabel.includes('broken') || lowerLabel.includes('offline') || lowerLabel.includes('dead') || lowerLabel.includes('invalid')
          ) return;
          if (seenUrls.has(clean)) return;
          seenUrls.add(clean);
          rawSources.push({ url: clean, rawLabel: label });
        };

        let episodeTitle = '';
        let animeTitle = '';
        let epNum: number | undefined = undefined;

        // Fetch episode page with domain fallback
        const candidateDomains = ['https://toon-stream.site', 'https://toonstream.one', 'https://toonstream.co'];
        let epResponse: Response | null = null;
        let effectiveTargetUrl = targetUrl;

        for (const dom of candidateDomains) {
          const testUrl = targetUrl.startsWith('http')
            ? targetUrl.replace(/^https?:\/\/[^/]+/i, dom)
            : `${dom}/${targetUrl.replace(/^\/+/, '')}`;

          epResponse = await fetch(testUrl, {
            headers: { ...HEADERS, Referer: `${dom}/` },
            signal: AbortSignal.timeout(4500)
          }).catch(() => null);

          if (epResponse && epResponse.ok) {
            effectiveTargetUrl = testUrl;
            break;
          }
        }

        if (epResponse && epResponse.ok) {
          const html = await epResponse.text();

          // Title parsing
          const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
          if (titleMatch) {
            episodeTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
          }

          const epNumMatch = effectiveTargetUrl.match(/(?:ep|-)?(\d+)(?:\/|$)/i) || episodeTitle.match(/(?:Episode|Ep)\s*(\d+)/i);
          if (epNumMatch) epNum = parseInt(epNumMatch[1], 10);

          const targetOrigin = new URL(effectiveTargetUrl).origin;

          // 1. Parse Dooplay / player option items
          const optionRegex = /<li[^>]*id=["']player-option-(\d+)["'][^>]*>(.*?)<\/li>/gis;
          let optMatch: RegExpExecArray | null;
          const ajaxTasks: { pId: string; pType: string; pNume: string; label: string }[] = [];

          while ((optMatch = optionRegex.exec(html)) !== null) {
            const fullTag = optMatch[0] || '';
            const optNum = optMatch[1];
            const inner = optMatch[2] || '';

            const labelMatch = inner.match(/<span[^>]*class=["'](?:title|server)["'][^>]*>([^<]+)<\/span>/i);
            const label = labelMatch ? labelMatch[1].trim() : `Server ${optNum}`;

            const directUrlMatch = fullTag.match(/(?:src|data-src|data-link)=["']([^"']+)["']/i) || inner.match(/href=["']([^"']+)["']/i);
            if (directUrlMatch && directUrlMatch[1] && !directUrlMatch[1].startsWith('javascript:')) {
              addRawSource(directUrlMatch[1], label);
            } else {
              const postIdM = fullTag.match(/data-post=["'](\d+)["']/i) || fullTag.match(/data-id=["'](\d+)["']/i) || html.match(/data-post=["'](\d+)["']/i);
              const typeM = fullTag.match(/data-type=["']([^"']+)["']/i);
              const numeM = fullTag.match(/data-nume=["']([^"']+)["']/i) || [null, optNum];

              if (postIdM && postIdM[1]) {
                ajaxTasks.push({
                  pId: postIdM[1],
                  pType: typeM ? typeM[1] : 'tv',
                  pNume: numeM && numeM[1] ? numeM[1] : optNum,
                  label
                });
              }
            }
          }

          // Execute AJAX player requests in parallel
          if (ajaxTasks.length > 0) {
            const ajaxUrl = `${targetOrigin}/wp-admin/admin-ajax.php`;
            await Promise.all(
              ajaxTasks.map(async (task) => {
                try {
                  const body = new URLSearchParams();
                  body.append('action', 'doo_player_dooplay');
                  body.append('post', task.pId);
                  body.append('type', task.pType);
                  body.append('nume', task.pNume);

                  const aRes = await fetch(ajaxUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                      'X-Requested-With': 'XMLHttpRequest',
                      'Referer': targetUrl,
                      'User-Agent': HEADERS['User-Agent']
                    },
                    body: body.toString(),
                    signal: AbortSignal.timeout(1800)
                  }).catch(() => null);

                  if (aRes && aRes.ok) {
                    const text = await aRes.text();
                    let embedSrc = '';
                    if (text.trim().startsWith('{')) {
                      try {
                        const parsed = JSON.parse(text);
                        embedSrc = parsed.embed_url || parsed.url || parsed.embed || parsed.html;
                      } catch (_) {}
                    }
                    if (!embedSrc) {
                      const frameM = text.match(/<iframe[^>]+(?:src|data-src)=["']([^"']+)["']/i) ||
                                     text.match(/(https?:\/\/[^\s"']+\/embed\/[^\s"']+)/i) ||
                                     text.match(/(https?:\/\/[^\s"']+)/i);
                      if (frameM && frameM[1]) embedSrc = frameM[1];
                    }
                    if (embedSrc) {
                      addRawSource(embedSrc, task.label);
                    }
                  }
                } catch (_) {}
              })
            );
          }

          // 2. Extract iframe sources from page HTML
          const iframeMatches = [...html.matchAll(/<iframe[^>]+(?:src|data-src|data-link)=["']([^"']+)["']/gi)];
          for (const m of iframeMatches) {
            if (m[1]) addRawSource(m[1]);
          }
        }

        if (rawSources.length === 0) {
          addRawSource(targetUrl, 'Direct Source');
        }

        // Parallel unwrap and validation of each source
        const resolvedSources: ToonStreamPlaybackSource[] = await Promise.all(
          rawSources.map(async (raw, idx) => {
            let finalEmbedUrl = raw.url;

            // Unwrap ToonStream internal embed wrappers if needed
            if (finalEmbedUrl.includes('toon-stream.site') || finalEmbedUrl.includes('toonstream')) {
              try {
                const uRes = await fetch(finalEmbedUrl, {
                  headers: HEADERS,
                  signal: AbortSignal.timeout(2000)
                }).catch(() => null);

                if (uRes && uRes.ok) {
                  const uHtml = await uRes.text();
                  const frameM = uHtml.match(/<iframe[^>]+(?:src|data-src)=["']([^"']+)["']/i) ||
                                 uHtml.match(/(https?:\/\/(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\/[^\s"']+)/i);
                  if (frameM && frameM[1] && !frameM[1].includes('youtube.com') && !frameM[1].includes('toon-stream') && !frameM[1].includes('toonstream')) {
                    finalEmbedUrl = frameM[1].trim();
                  }
                }
              } catch (_) {}
            }

            const providerName = deriveProviderName(finalEmbedUrl, raw.rawLabel);
            const language = detectLanguageFromSource(finalEmbedUrl, raw.rawLabel);
            const validation = await validateSourceUrl(finalEmbedUrl);

            return {
              providerName,
              embedUrl: finalEmbedUrl,
              language,
              priority: idx + 1,
              status: validation.status,
              metadata: {
                headers: {
                  'User-Agent': HEADERS['User-Agent'],
                  'Referer': `${BASE_URL}/`
                },
                referer: `${BASE_URL}/`,
                requiresProxy: finalEmbedUrl.includes('rubystm') || finalEmbedUrl.includes('streamruby') || finalEmbedUrl.includes('gdmirror') || finalEmbedUrl.includes('upns'),
                redirectChain: validation.redirectChain,
                httpStatus: validation.httpStatus
              }
            };
          })
        );

        // Fetch AnimeWorld backup sources as fallback / extra backup servers
        try {
          const awSources = await AnimeWorldConnectorService.getEpisodePlaybackSources(
            targetUrl || episodeIdOrUrl,
            epNum || 1
          );

          if (awSources && awSources.length > 0) {
            for (const aw of awSources) {
              if (aw.embedUrl && !resolvedSources.some(existing => existing.embedUrl.toLowerCase() === aw.embedUrl.toLowerCase())) {
                resolvedSources.push({
                  providerName: aw.providerName,
                  embedUrl: aw.embedUrl,
                  language: aw.language || 'Japanese',
                  priority: aw.priority,
                  status: aw.status,
                  metadata: {
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://watchanimeworld.org/' },
                    referer: 'https://watchanimeworld.org/',
                    requiresProxy: false
                  }
                });
              }
            }
          }
        } catch (_) {}

        const availableLanguages = Array.from(new Set(resolvedSources.map(s => s.language)));

        // Automatically filter out invalid / expired / dead 404 servers
        const workingSourcesOnly = resolvedSources.filter(s => s.status !== 'invalid' && s.status !== 'expired');
        const activeSources = workingSourcesOnly.length > 0 ? workingSourcesOnly : resolvedSources;

        return {
          episodeId: targetUrl.replace(BASE_URL, '').replace(/^\/+|\/+$/g, '').replace(/\//g, '-'),
          episodeUrl: targetUrl,
          episodeNumber: epNum,
          animeTitle,
          episodeTitle,
          availableLanguages: availableLanguages.length > 0 ? availableLanguages : ['Japanese'],
          sources: activeSources
        };
      },
      900 // Cache playback source data for 15 minutes
    );
  }
}
