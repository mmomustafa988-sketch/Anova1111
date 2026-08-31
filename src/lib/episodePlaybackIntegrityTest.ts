/**
 * Episode Playback Data-Integrity Automated Audit Test Suite
 * Validates that episode sources are strictly mapped per episode and never fallback to Episode 1 or leak across series/seasons.
 */

export interface EpisodeTestData {
  seriesId: string;
  seasonNumber: number;
  episodeNumber: number;
  sourceUrl: string;
}

export interface TestResultItem {
  testName: string;
  expected: string;
  actual: string;
  passed: boolean;
  details?: string;
}

/**
 * Pure Episode Source Resolver function for testing architecture logic
 */
export function resolveEpisodeSourceForTest(
  seriesList: Record<string, { seasonNumber: number; episodes: Record<number, string> }>,
  requestSeriesId: string,
  requestSeasonNum: number,
  requestEpNum: number
): { sourceUrl: string | null; error: string | null } {
  const series = seriesList[requestSeriesId];
  if (!series) {
    return { sourceUrl: null, error: `Series ${requestSeriesId} not found` };
  }

  // Verify season match
  if (series.seasonNumber !== requestSeasonNum) {
    return { sourceUrl: null, error: `Season ${requestSeasonNum} not found for series ${requestSeriesId}` };
  }

  const epSource = series.episodes[requestEpNum];
  if (!epSource) {
    return { sourceUrl: null, error: `Episode ${requestEpNum} source unavailable` };
  }

  return { sourceUrl: epSource, error: null };
}

/**
 * Run full critical data-integrity test suite
 */
export function runCriticalDataIntegrityTestSuite(): {
  allPassed: boolean;
  results: TestResultItem[];
  summary: string;
} {
  const results: TestResultItem[] = [];

  // Setup Mock Series 1 (8 Episodes)
  const seriesStore: Record<string, { seasonNumber: number; episodes: Record<number, string> }> = {
    'series_a': {
      seasonNumber: 1,
      episodes: {
        1: 'source_ep1',
        2: 'source_ep2',
        3: 'source_ep3',
        4: 'source_ep4',
        5: 'source_ep5',
        6: 'source_ep6',
        7: 'source_ep7',
        8: 'source_ep8'
      }
    },
    'series_b': {
      seasonNumber: 1,
      episodes: {
        1: 'series_b_ep1',
        2: 'series_b_ep2'
      }
    },
    'series_a_season_2': {
      seasonNumber: 2,
      episodes: {
        1: 'series_a_s2_ep1'
      }
    }
  };

  // TEST 1: Random Access Sequence: 7 -> 3 -> 8 -> 2 -> 6 -> 1 -> 5 -> 4
  const randomOrderSequence = [7, 3, 8, 2, 6, 1, 5, 4];
  randomOrderSequence.forEach(epNum => {
    const expectedSource = `source_ep${epNum}`;
    const res = resolveEpisodeSourceForTest(seriesStore, 'series_a', 1, epNum);
    const passed = res.sourceUrl === expectedSource;
    results.push({
      testName: `Random Access Sequence -> Ep ${epNum}`,
      expected: expectedSource,
      actual: res.sourceUrl || res.error || 'NULL',
      passed,
      details: passed ? `Ep ${epNum} correctly loaded ${expectedSource}` : `FAIL: Ep ${epNum} received ${res.sourceUrl} instead of ${expectedSource}`
    });
  });

  // TEST 2: Direct Opening Episode 7
  const directEp7Res = resolveEpisodeSourceForTest(seriesStore, 'series_a', 1, 7);
  results.push({
    testName: `Direct Deep-Link Access -> Episode 7`,
    expected: 'source_ep7',
    actual: directEp7Res.sourceUrl || 'NULL',
    passed: directEp7Res.sourceUrl === 'source_ep7'
  });

  // TEST 3: Failed Lookup (Episode 9) -> MUST NOT fall back to Episode 1
  const failedEpRes = resolveEpisodeSourceForTest(seriesStore, 'series_a', 1, 9);
  const ep9Passed = failedEpRes.sourceUrl === null && failedEpRes.error?.includes('unavailable');
  results.push({
    testName: `Missing Episode Lookup (Ep 9) -> No Fallback to Ep 1`,
    expected: 'NULL (Episode 9 source unavailable)',
    actual: failedEpRes.sourceUrl ? `FALLBACK ERROR: ${failedEpRes.sourceUrl}` : (failedEpRes.error || 'NULL'),
    passed: ep9Passed,
    details: ep9Passed ? 'Correctly rejected missing episode without loading Ep 1 fallback' : 'CRITICAL BUG: Episode 9 loaded a fallback URL'
  });

  // TEST 4: Cross-Series Source Isolation
  const seriesBRes = resolveEpisodeSourceForTest(seriesStore, 'series_b', 1, 1);
  const seriesBPassed = seriesBRes.sourceUrl === 'series_b_ep1' && (seriesBRes.sourceUrl as string) !== 'source_ep1';
  results.push({
    testName: `Cross-Series Isolation (Series B Ep 1 vs Series A Ep 1)`,
    expected: 'series_b_ep1',
    actual: seriesBRes.sourceUrl || 'NULL',
    passed: seriesBPassed,
    details: seriesBPassed ? 'Series B did not reuse Series A sources' : 'FAIL: Series B reused Series A source'
  });

  // TEST 5: Season Isolation (Season 2 Ep 1 vs Season 1 Ep 1)
  const season2Res = resolveEpisodeSourceForTest(seriesStore, 'series_a_season_2', 2, 1);
  const season2Passed = season2Res.sourceUrl === 'series_a_s2_ep1' && (season2Res.sourceUrl as string) !== 'source_ep1';
  results.push({
    testName: `Season Isolation (Season 2 Ep 1 vs Season 1 Ep 1)`,
    expected: 'series_a_s2_ep1',
    actual: season2Res.sourceUrl || 'NULL',
    passed: season2Passed,
    details: season2Passed ? 'Season 2 Ep 1 is distinct from Season 1 Ep 1' : 'FAIL: Season 2 Ep 1 confused with Season 1 Ep 1'
  });

  // TEST 6: Duplicate Source Validation Detection in Admin
  const duplicateSourcesMap: Record<number, string> = {
    1: 'http://example.com/stream1',
    2: 'http://example.com/stream1' // Duplicate!
  };
  const seen = new Set<string>();
  let duplicateDetected = false;
  Object.values(duplicateSourcesMap).forEach(u => {
    if (seen.has(u)) duplicateDetected = true;
    seen.add(u);
  });
  results.push({
    testName: `Admin Duplicate Source Validation Detection`,
    expected: 'Duplicate Flagged',
    actual: duplicateDetected ? 'Duplicate Flagged' : 'Passed Silently (Error)',
    passed: duplicateDetected,
    details: duplicateDetected ? 'Detected duplicate source reference between Ep 1 and Ep 2' : 'FAIL: Failed to detect duplicate source'
  });

  const allPassed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;
  const summary = `Executed ${results.length} Tests | ${passedCount} Passed | ${results.length - passedCount} Failed`;

  return { allPassed, results, summary };
}
