// Anime Metadata Enrichment Service
// Priority order: 1. AniList API -> 2. Jikan API (MyAnimeList) -> 3. Kitsu API -> Default clean fallback

import { COMPREHENSIVE_ANIME_CATALOG } from '../data/animeDatabase';

export interface AnimeMetadata {
  title: string;
  englishTitle?: string;
  romajiTitle?: string;
  poster: string;
  banner: string;
  description: string;
  genres: string[];
  episodesCount?: number;
  rating?: string;
  type?: string;
  status?: string;
  studio?: string;
  source?: 'anilist' | 'jikan' | 'kitsu' | 'catalog' | 'fallback';
}

const CACHE_KEY = 'anova_anime_metadata_cache_v3';
const MEMORY_CACHE = new Map<string, AnimeMetadata>();

// Pre-seed memory cache with our high-res curated catalog
COMPREHENSIVE_ANIME_CATALOG.forEach(item => {
  if (item && item.title) {
    const rawKey = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanKey = cleanTitleForMetadataSearch(item.title).toLowerCase();
    const meta: AnimeMetadata = {
      title: item.title,
      englishTitle: item.title,
      poster: item.poster,
      banner: item.banner || item.poster,
      description: item.description || '',
      genres: item.genres || [],
      episodesCount: item.episodes || 12,
      rating: item.rating || '9.0',
      type: item.type || 'TV',
      status: item.status || 'Completed',
      studio: item.studio || 'Anova',
      source: 'catalog'
    };
    if (rawKey) MEMORY_CACHE.set(rawKey, meta);
    if (cleanKey) MEMORY_CACHE.set(cleanKey, meta);
  }
});

// Load initial persistent cache from localStorage
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([k, v]) => {
        MEMORY_CACHE.set(k, v as AnimeMetadata);
      });
    }
  } catch (_) {}
}

const saveCacheToStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, AnimeMetadata> = {};
    // Save up to 500 recent entries to keep localStorage footprint reasonable
    const entries = Array.from(MEMORY_CACHE.entries()).slice(-500);
    entries.forEach(([k, v]) => {
      obj[k] = v;
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch (_) {}
};

/**
 * Check if image URL is invalid, broken, or contains ToonStream / ST branding logos
 */
export function isInvalidImage(url?: string): boolean {
  if (!url || typeof url !== 'string') return true;
  const lower = url.toLowerCase().trim();
  if (!lower || lower.length < 5) return true;

  // Specific red anime girl unsplash URL used as temporary placeholder
  if (lower.includes('photo-1578632767115-351597cf2477')) return true;

  // Default / generic branding logo or broken placeholder
  const isLogo = (
    lower.includes('/st.png') ||
    lower.includes('/st.jpg') ||
    lower.includes('/st.webp') ||
    lower.includes('st-logo') ||
    lower.includes('toonstream-logo') ||
    lower.includes('/logo.png') ||
    lower.includes('cropped-') ||
    lower.includes('favicon') ||
    lower.includes('default-poster') ||
    lower.includes('placeholder')
  );
  if (isLogo) return true;

  return false;
}

/**
 * Clean anime title for accurate API searching
 */
export function cleanTitleForMetadataSearch(rawTitle: string): string {
  if (!rawTitle) return '';
  let cleaned = String(rawTitle)
    .replace(/^toonstream-/i, '')
    .replace(/^moviebox-/i, '')
    .replace(/^anikoto-/i, '')
    .replace(/\b\d+x\d+\b/gi, '') // Remove season x episode like 1x4
    .replace(/\bSeason\s*\d+\b/gi, '')
    .replace(/\bEpisode\s*\d+\b/gi, '')
    .replace(/-\s*toonstream.*$/i, '')
    .replace(/-\s*anova.*$/i, '')
    .replace(/\b(hindi|english|sub|dub|dubbed)\b/gi, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

/**
 * Synchronously get cached metadata if available
 */
export function getCachedMetadata(rawTitle: string): AnimeMetadata | null {
  const cleanKey = cleanTitleForMetadataSearch(rawTitle).toLowerCase();
  if (!cleanKey) return null;
  return MEMORY_CACHE.get(cleanKey) || null;
}

/**
 * Fetch anime metadata hierarchically: AniList -> Jikan -> Kitsu
 */
export async function fetchAnimeMetadata(rawTitle: string): Promise<AnimeMetadata | null> {
  const cleanQuery = cleanTitleForMetadataSearch(rawTitle);
  if (!cleanQuery || cleanQuery.length < 2) return null;

  const cacheKey = cleanQuery.toLowerCase();
  const existing = MEMORY_CACHE.get(cacheKey);
  if (existing) return existing;

  // 1. Priority 1: Kitsu API (High-speed, zero rate limit, guaranteed 200 CDN assets)
  try {
    const res = await fetch(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(cleanQuery)}&page[limit]=1`);
    if (res.ok) {
      const json = await res.json();
      const anime = json.data?.[0]?.attributes;
      if (anime) {
        const poster = anime.posterImage?.large || anime.posterImage?.original || anime.posterImage?.medium || '';
        const banner = anime.coverImage?.large || anime.coverImage?.original || poster;
        const title = anime.canonicalTitle || anime.titles?.en || cleanQuery;

        if (poster && !isInvalidImage(poster)) {
          const result: AnimeMetadata = {
            title,
            englishTitle: anime.titles?.en || '',
            romajiTitle: anime.canonicalTitle || '',
            poster,
            banner: banner && !isInvalidImage(banner) ? banner : poster,
            description: (anime.synopsis || '').trim() || `Watch ${title} on Anova in HD with sub and dub.`,
            genres: [],
            episodesCount: anime.episodeCount || undefined,
            rating: anime.averageRating ? (parseFloat(anime.averageRating) / 10).toFixed(1) : '8.8',
            type: anime.showType === 'movie' ? 'Movie' : 'TV',
            status: anime.status === 'finished' ? 'Completed' : 'Ongoing',
            studio: 'Anova',
            source: 'kitsu'
          };

          MEMORY_CACHE.set(cacheKey, result);
          saveCacheToStorage();
          return result;
        }
      }
    }
  } catch (err) {
    console.warn('[Kitsu Metadata Fetch Error]:', err);
  }

  // 2. Priority 2: AniList GraphQL API
  try {
    const query = `
      query ($search: String) {
        Media (search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id
          title { english romaji native }
          format
          status
          description(asHtml: false)
          episodes
          coverImage { extraLarge large medium }
          bannerImage
          genres
          averageScore
          meanScore
          studios(isMain: true) { nodes { name } }
        }
      }
    `;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { search: cleanQuery } })
    });

    if (res.ok) {
      const json = await res.json();
      const media = json.data?.Media;
      if (media && (media.coverImage?.extraLarge || media.coverImage?.large)) {
        let desc = media.description || '';
        desc = desc.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();

        const poster = media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '';
        const banner = media.bannerImage || poster;
        const title = media.title?.english || media.title?.romaji || cleanQuery;

        if (poster && !isInvalidImage(poster)) {
          const result: AnimeMetadata = {
            title,
            englishTitle: media.title?.english || '',
            romajiTitle: media.title?.romaji || '',
            poster,
            banner,
            description: desc || `Watch ${title} on Anova in HD with sub and dub.`,
            genres: media.genres || [],
            episodesCount: media.episodes || undefined,
            rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : (media.meanScore ? (media.meanScore / 10).toFixed(1) : '8.5'),
            type: media.format === 'MOVIE' ? 'Movie' : (media.format === 'OVA' ? 'OVA' : (media.format === 'ONA' ? 'ONA' : 'TV')),
            status: media.status === 'FINISHED' ? 'Completed' : 'Ongoing',
            studio: media.studios?.nodes?.[0]?.name || 'Anova',
            source: 'anilist'
          };

          MEMORY_CACHE.set(cacheKey, result);
          saveCacheToStorage();
          return result;
        }
      }
    }
  } catch (err) {
    console.warn('[AniList Metadata Fetch Error]:', err);
  }

  // 3. Priority 3: Jikan API (MyAnimeList)
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanQuery)}&limit=1`);
    if (res.ok) {
      const json = await res.json();
      const anime = json.data?.[0];
      if (anime) {
        const poster = anime.images?.jpg?.large_image_url || anime.images?.webp?.large_image_url || '';
        const banner = anime.trailer?.images?.maximum_image_url || poster;
        const title = anime.title_english || anime.title || cleanQuery;

        if (poster && !isInvalidImage(poster)) {
          const result: AnimeMetadata = {
            title,
            englishTitle: anime.title_english || '',
            romajiTitle: anime.title || '',
            poster,
            banner,
            description: (anime.synopsis || '').trim() || `Watch ${title} on Anova.`,
            genres: anime.genres?.map((g: any) => g.name) || [],
            episodesCount: anime.episodes || undefined,
            rating: anime.score ? String(anime.score) : '8.5',
            type: anime.type === 'Movie' ? 'Movie' : (anime.type === 'OVA' ? 'OVA' : 'TV'),
            status: anime.status === 'Finished Airing' ? 'Completed' : 'Ongoing',
            studio: anime.studios?.[0]?.name || 'Anova',
            source: 'jikan'
          };

          MEMORY_CACHE.set(cacheKey, result);
          saveCacheToStorage();
          return result;
        }
      }
    }
  } catch (err) {
    console.warn('[Jikan Metadata Fetch Error]:', err);
  }

  return null;
}

/**
 * Enrich an anime object with AniList/Jikan metadata if needed
 */
export async function enrichAnimeWithMetadata(anime: any): Promise<any> {
  if (!anime) return anime;

  const rawTitle = anime.title || '';
  const cleanTitle = cleanTitleForMetadataSearch(rawTitle);

  // Check if we already have valid poster and non-ToonStream description
  const posterInvalid = isInvalidImage(anime.poster);
  const bannerInvalid = isInvalidImage(anime.banner);
  const descriptionHasToonstream = !anime.description || anime.description.toLowerCase().includes('toonstream');

  if (!posterInvalid && !bannerInvalid && !descriptionHasToonstream && anime.genres?.length > 0) {
    return anime;
  }

  // Try cached or async metadata fetch
  let meta = getCachedMetadata(rawTitle);
  if (!meta && cleanTitle) {
    meta = await fetchAnimeMetadata(rawTitle);
  }

  if (meta) {
    return {
      ...anime,
      title: meta.title || cleanTitle || anime.title,
      poster: !isInvalidImage(meta.poster) ? meta.poster : (anime.poster && !isInvalidImage(anime.poster) ? anime.poster : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80'),
      banner: !isInvalidImage(meta.banner) ? meta.banner : (anime.banner && !isInvalidImage(anime.banner) ? anime.banner : meta.poster),
      description: meta.description || anime.description?.replace(/toonstream/gi, 'Anova') || `Watch ${meta.title} on Anova.`,
      genres: meta.genres && meta.genres.length > 0 ? meta.genres : (anime.genres || []),
      episodes: meta.episodesCount || anime.episodes || anime.episodesCount || 12,
      rating: meta.rating || anime.rating || '8.5',
      type: meta.type || anime.type || 'TV',
      status: meta.status || anime.status || 'Ongoing',
      studio: meta.studio || anime.studio || 'Anova'
    };
  }

  // Fallback if no metadata found: clean existing fields from Toonstream references
  const cleanDesc = (anime.description || '').replace(/toonstream/gi, 'Anova');
  const cleanStudio = (anime.studio || '').replace(/toonstream/gi, 'Anova');

  return {
    ...anime,
    title: cleanTitle || anime.title,
    poster: !posterInvalid ? anime.poster : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    banner: !bannerInvalid ? anime.banner : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&auto=format&fit=crop&q=80',
    description: cleanDesc || `Watch ${cleanTitle || anime.title} on Anova.`,
    studio: cleanStudio || 'Anova'
  };
}
