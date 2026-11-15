// The app is served under NEXT_PUBLIC_BASE_PATH (/ugt-lube-monitoring). next/link and
// router.push add it themselves; raw fetch() / <a href> / window.open do not.
// process.env directly: NEXT_PUBLIC_* read through createEnv() is '' in the client bundle.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
