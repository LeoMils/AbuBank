/*
 * worktree-classify-lib.mjs — PURE runtime/harness dirty-file classification. (§5 clean-cert detector)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Decides whether a dirty path is a release-RUNTIME file, a release-HARNESS file, or generated/allowed.
 * A dirty executable harness file must make WORKTREE_HARNESS_CLEAN=false (so a dirty-harness capsule can
 * never masquerade as the FINAL clean capsule). No I/O.
 */
export const isRuntimeFile = (f) =>
  /^(api\/|src\/)/.test(f) && !/\.test\.(ts|tsx)$/.test(f) && !/^src\/(eval|.*\/diagnostics)\//.test(f)

export const isHarnessFile = (f) =>
  (/\.test\.(ts|tsx)$/.test(f) || /^scripts\//.test(f) || /^src\/engineering-os\//.test(f)
    || /^\.github\/workflows\//.test(f) || /^(vitest|vite|tsconfig)/.test(f)) && !isRuntimeFile(f)

export function classifyDirty(dirtyPaths = []) {
  const dirtyRuntime = dirtyPaths.filter(isRuntimeFile)
  const dirtyHarness = dirtyPaths.filter(isHarnessFile)
  return {
    dirtyRuntime, dirtyHarness,
    WORKTREE_RUNTIME_CLEAN: dirtyRuntime.length === 0,
    WORKTREE_HARNESS_CLEAN: dirtyHarness.length === 0,
  }
}
