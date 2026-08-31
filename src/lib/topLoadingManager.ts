// Real-time Top Progress & Media Loading Manager
type TopLoadingListener = (state: TopLoadingState) => void;

export interface TopLoadingState {
  progress: number;
  visible: boolean;
  isLoading: boolean;
}

class TopLoadingManager {
  private progress = 0;
  private visible = false;
  private isLoading = false;
  private listeners = new Set<TopLoadingListener>();
  private tickerTimer: any = null;
  private finishTimer: any = null;
  private resetTimer: any = null;
  private safetyTimeoutTimer: any = null;

  private notify() {
    const state: TopLoadingState = {
      progress: this.progress,
      visible: this.visible,
      isLoading: this.isLoading
    };
    this.listeners.forEach(cb => {
      try {
        cb(state);
      } catch (err) {
        console.error('[TopLoadingManager] Listener error:', err);
      }
    });
  }

  public subscribe(cb: TopLoadingListener): () => void {
    this.listeners.add(cb);
    cb({
      progress: this.progress,
      visible: this.visible,
      isLoading: this.isLoading
    });
    return () => {
      this.listeners.delete(cb);
    };
  }

  public start(_token?: string): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    if (this.finishTimer) {
      clearTimeout(this.finishTimer);
      this.finishTimer = null;
    }
    if (this.safetyTimeoutTimer) {
      clearTimeout(this.safetyTimeoutTimer);
      this.safetyTimeoutTimer = null;
    }

    this.isLoading = true;
    this.visible = true;
    this.progress = Math.max(this.progress > 0 && this.progress < 90 ? this.progress : 25, 25);
    this.notify();
    this.runProgressTicker();

    // 8-second safety timeout so the progress line NEVER gets stuck under any circumstance
    this.safetyTimeoutTimer = setTimeout(() => {
      if (this.isLoading) {
        this.finish();
      }
    }, 8000);
  }

  private runProgressTicker(): void {
    if (this.tickerTimer) clearInterval(this.tickerTimer);

    this.tickerTimer = setInterval(() => {
      if (!this.isLoading) {
        clearInterval(this.tickerTimer);
        this.tickerTimer = null;
        return;
      }

      // Fast, smooth realistic asymptotic curve towards 92%
      if (this.progress < 55) {
        this.progress += Math.random() * 9 + 5;
      } else if (this.progress < 78) {
        this.progress += Math.random() * 5 + 2.5;
      } else if (this.progress < 90) {
        this.progress += Math.random() * 2 + 1;
      } else if (this.progress < 96) {
        this.progress += Math.random() * 0.5 + 0.1;
      }

      this.progress = Math.min(96, this.progress);
      this.notify();
    }, 100);
  }

  public finish(_token?: string): void {
    if (this.tickerTimer) {
      clearInterval(this.tickerTimer);
      this.tickerTimer = null;
    }
    if (this.safetyTimeoutTimer) {
      clearTimeout(this.safetyTimeoutTimer);
      this.safetyTimeoutTimer = null;
    }

    this.isLoading = false;
    this.progress = 100;
    this.notify();

    if (this.finishTimer) clearTimeout(this.finishTimer);
    this.finishTimer = setTimeout(() => {
      this.visible = false;
      this.notify();

      if (this.resetTimer) clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => {
        if (!this.isLoading) {
          this.progress = 0;
          this.notify();
        }
      }, 250);
    }, 240);
  }

  public forceFinish(): void {
    this.finish();
  }

  public getState(): TopLoadingState {
    return {
      progress: this.progress,
      visible: this.visible,
      isLoading: this.isLoading
    };
  }
}

export const topLoadingManager = new TopLoadingManager();

export const startTopLoading = (token?: string) => topLoadingManager.start(token);
export const finishTopLoading = (token?: string) => topLoadingManager.finish(token);
export const forceFinishTopLoading = () => topLoadingManager.forceFinish();

/**
 * Preload an image URL into browser cache and resolve true when actually loaded into memory.
 */
export function preloadImage(url: string, timeoutMs: number = 6000): Promise<boolean> {
  if (!url || typeof url !== 'string' || !url.trim() || url.startsWith('about:blank')) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let resolved = false;
    const cleanUrl = url.trim();

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    }, timeoutMs);

    const img = new Image();
    img.referrerPolicy = 'no-referrer';

    const onComplete = (success: boolean) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(success);
      }
    };

    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(() => onComplete(true)).catch(() => onComplete(true));
      } else {
        onComplete(true);
      }
    };

    img.onerror = () => {
      onComplete(false);
    };

    img.src = cleanUrl;

    // If image is already cached in browser memory
    if (img.complete && img.naturalWidth > 0) {
      onComplete(true);
    }
  });
}

/**
 * Preload both Poster and Banner in parallel and resolve when loaded or timed out.
 */
export async function preloadAnimeMedia(posterUrl?: string, bannerUrl?: string, timeoutMs: number = 5500): Promise<{ posterLoaded: boolean; bannerLoaded: boolean }> {
  const promises: [Promise<boolean>, Promise<boolean>] = [
    posterUrl ? preloadImage(posterUrl, timeoutMs) : Promise.resolve(false),
    bannerUrl && bannerUrl !== posterUrl ? preloadImage(bannerUrl, timeoutMs) : Promise.resolve(false)
  ];

  const [posterLoaded, bannerLoaded] = await Promise.all(promises);
  return { posterLoaded, bannerLoaded: bannerUrl === posterUrl ? posterLoaded : bannerLoaded };
}
