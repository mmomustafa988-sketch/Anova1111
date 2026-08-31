// @ts-nocheck
import { Anime } from '../types';

export class HomeDeduplicationManager {
  private allocatedIds = new Set<string>();
  private allocatedTitles = new Set<string>();

  /**
   * Reset all allocated tracking (used on home refresh/unmount)
   */
  reset() {
    this.allocatedIds.clear();
    this.allocatedTitles.clear();
  }

  private normalizeTitle(title?: string): string {
    if (!title) return '';
    return title.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  }

  /**
   * Reserve animes so they are never repeated in other categories
   * (e.g. Hero Banner Spotlight items, Top 10 Ranked items)
   */
  reserve(animes: Anime[]) {
    if (!animes || !Array.isArray(animes)) return;
    for (const a of animes) {
      if (!a) continue;
      const idStr = String(a.id || '');
      if (idStr) this.allocatedIds.add(idStr);
      const normTitle = this.normalizeTitle(a.title);
      if (normTitle && normTitle.length > 2) {
        this.allocatedTitles.add(normTitle);
      }
    }
  }

  /**
   * Check if an anime is already allocated in an earlier section
   */
  isAllocated(anime: Anime): boolean {
    if (!anime) return true;
    const idStr = String(anime.id || '');
    if (idStr && this.allocatedIds.has(idStr)) return true;
    const normTitle = this.normalizeTitle(anime.title);
    if (normTitle && normTitle.length > 2 && this.allocatedTitles.has(normTitle)) {
      return true;
    }
    return false;
  }

  /**
   * Filter a candidate list to ONLY return unique, unallocated animes for this section,
   * and automatically register them so subsequent categories do NOT duplicate them.
   */
  allocateForSection(animes: Anime[], maxCount: number = 18): Anime[] {
    if (!animes || !Array.isArray(animes)) return [];
    const uniqueForSection: Anime[] = [];
    const seenInBatch = new Set<string>();

    // Pass 1: Strict allocation (only items not seen in any earlier section)
    for (const item of animes) {
      if (!item || !item.id) continue;
      const idStr = String(item.id);
      const normTitle = this.normalizeTitle(item.title);

      if (seenInBatch.has(idStr)) continue;
      if (normTitle && seenInBatch.has(normTitle)) continue;

      if (this.isAllocated(item)) {
        continue; // Already displayed in another category/banner/top10!
      }

      seenInBatch.add(idStr);
      if (normTitle) seenInBatch.add(normTitle);
      this.allocatedIds.add(idStr);
      if (normTitle && normTitle.length > 2) {
        this.allocatedTitles.add(normTitle);
      }

      uniqueForSection.push(item);
      if (uniqueForSection.length >= maxCount) {
        break;
      }
    }

    // Pass 2: Graceful backfill if strict allocation returned fewer than 6 items
    if (uniqueForSection.length < 6 && animes.length > 0) {
      for (const item of animes) {
        if (!item || !item.id) continue;
        const idStr = String(item.id);
        const normTitle = this.normalizeTitle(item.title);

        if (seenInBatch.has(idStr)) continue;
        if (normTitle && seenInBatch.has(normTitle)) continue;

        seenInBatch.add(idStr);
        if (normTitle) seenInBatch.add(normTitle);
        this.allocatedIds.add(idStr);
        if (normTitle && normTitle.length > 2) {
          this.allocatedTitles.add(normTitle);
        }

        uniqueForSection.push(item);
        if (uniqueForSection.length >= maxCount) {
          break;
        }
      }
    }

    return uniqueForSection;
  }

  /**
   * Get total count of allocated unique IDs
   */
  getAllocatedCount(): number {
    return this.allocatedIds.size;
  }
}

export const globalHomeDeduplicator = new HomeDeduplicationManager();
