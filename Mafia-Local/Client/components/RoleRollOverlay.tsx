import React from "react"
import type { RoleRollCandidate } from "../src/roleRoll.js"
import "../src/styles/components/role-roll-overlay.css"

type Props = {
  open: boolean
  title?: string
  finalLabel: string
  finalImageSrc?: string | null
  candidates: RoleRollCandidate[]
  durationMs?: number
  spinIntervalMs?: number
  revealMs?: number
  onComplete: () => void
  onSkip: () => void
}

const randomPick = (items: RoleRollCandidate[]): RoleRollCandidate => {
  if (items.length <= 0) return { label: "Unknown" }
  const idx = Math.floor(Math.random() * items.length)
  return items[idx] ?? items[0] ?? { label: "Unknown" }
}

export default function RoleRollOverlay({
  open,
  title = "Assigning Role",
  finalLabel,
  finalImageSrc,
  candidates,
  durationMs = 2800,
  spinIntervalMs = 90,
  revealMs = 1200,
  onComplete,
  onSkip,
}: Props) {
  const makeCandidate = React.useCallback(
    (label: string, imageSrc: string | null | undefined): RoleRollCandidate => ({
      label,
      imageSrc: imageSrc ?? null,
    }),
    []
  )

  const [display, setDisplay] = React.useState<RoleRollCandidate>({
    label: finalLabel,
    imageSrc: finalImageSrc ?? null,
  })
  const [revealed, setRevealed] = React.useState(false)
  const completeCalledRef = React.useRef(false)
  const onCompleteRef = React.useRef(onComplete)

  React.useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  React.useEffect(() => {
    if (!open) {
      setRevealed(false)
      setDisplay(makeCandidate(finalLabel, finalImageSrc))
      completeCalledRef.current = false
      return
    }

    const pool =
      candidates.length > 0
        ? candidates
        : [makeCandidate(finalLabel, finalImageSrc)]

    setRevealed(false)
    setDisplay(randomPick(pool))
    completeCalledRef.current = false

    const spinTimer = window.setInterval(() => {
      setDisplay(randomPick(pool))
    }, spinIntervalMs)
    let completeTimer: number | null = null

    const revealTimer = window.setTimeout(() => {
      window.clearInterval(spinTimer)
      setDisplay(makeCandidate(finalLabel, finalImageSrc))
      setRevealed(true)

      completeTimer = window.setTimeout(() => {
        if (completeCalledRef.current) return
        completeCalledRef.current = true
        onCompleteRef.current()
      }, revealMs)
    }, durationMs)

    return () => {
      window.clearInterval(spinTimer)
      window.clearTimeout(revealTimer)
      if (completeTimer) {
        window.clearTimeout(completeTimer)
      }
    }
  }, [
    open,
    candidates,
    durationMs,
    finalImageSrc,
    finalLabel,
    makeCandidate,
    revealMs,
    spinIntervalMs,
  ])

  if (!open) return null

  return (
    <div className="role-roll-overlay" role="dialog" aria-modal="true" aria-label="Role assignment animation">
      <div className="role-roll-overlay__card">
        <div className="role-roll-overlay__title">{title}</div>
        <div className="role-roll-overlay__reel-wrap">
          <div className={`role-roll-overlay__reel ${revealed ? "is-revealed" : ""}`}>
            {display.imageSrc ? (
              <img
                className="role-roll-overlay__image"
                src={display.imageSrc}
                alt={display.label}
                draggable={false}
              />
            ) : (
              <div className="role-roll-overlay__text-only">{display.label}</div>
            )}
          </div>
        </div>

        <div className="role-roll-overlay__label">
          {revealed ? `You are ${display.label}` : "Rolling..."}
        </div>

        <button
          type="button"
          className="role-roll-overlay__skip"
          onClick={onSkip}
        >
          Skip
        </button>
      </div>
    </div>
  )
}
