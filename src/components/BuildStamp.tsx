/**
 * The build's short commit SHA, parked in the bottom-left corner.
 *
 * It exists so a bug report from a tester names the build it came from. Muted
 * and non-interactive on purpose — `pointer-events-none` keeps it from eating
 * clicks meant for the canvas underneath.
 */
export function BuildStamp() {
  return (
    <div
      data-testid="build-stamp"
      className="pointer-events-none fixed bottom-1.5 left-2 z-40 select-none font-mono text-[10px] text-slate-600"
    >
      {__BUILD_SHA__}
    </div>
  )
}
