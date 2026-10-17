// A slow or metered connection (data saver on, or 2G/3G): the app loads less and later there.
type Conn = { saveData?: boolean; effectiveType?: string; addEventListener?: (t: string, f: () => void) => void }
const conn = () => (navigator as Navigator & { connection?: Conn }).connection
export const slowNet = () => {
  const c = conn()
  return !!c && (c.saveData === true || ['slow-2g', '2g', '3g'].includes(c.effectiveType ?? ''))
}
