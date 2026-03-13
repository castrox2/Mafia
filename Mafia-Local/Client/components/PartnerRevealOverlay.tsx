import React from "react"
import "../src/styles/components/partner-reveal-overlay.css"

type Props = {
  open: boolean
  roleLabel: string
  roleImageSrc?: string | null
  partnerNames: string[]
  onContinue: () => void
}

const getTitle = (roleLabel: string, partnerCount: number): string => {
  if (roleLabel === "Mafia") {
    return partnerCount === 1 ? "Your Mafia Partner" : "Your Mafia Partners"
  }
  if (roleLabel === "Doctor") {
    return partnerCount === 1 ? "Your Doctor Partner" : "Your Doctor Partners"
  }
  return partnerCount === 1 ? "Your Partner" : "Your Partners"
}

const getBodyCopy = (roleLabel: string): string => {
  if (roleLabel === "Mafia") {
    return "These players are on the mafia team with you."
  }
  if (roleLabel === "Doctor") {
    return "These players are also doctors, so you can work together."
  }
  return "These players are on your side."
}

export default function PartnerRevealOverlay({
  open,
  roleLabel,
  roleImageSrc,
  partnerNames,
  onContinue,
}: Props) {
  if (!open || partnerNames.length <= 0) return null

  const title = getTitle(roleLabel, partnerNames.length)
  const bodyCopy = getBodyCopy(roleLabel)

  return (
    <div
      className="partner-reveal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${roleLabel} partner reveal`}
    >
      <div className="partner-reveal-overlay__card">
        <div className="partner-reveal-overlay__eyebrow">Team Reveal</div>
        <div className="partner-reveal-overlay__title">{title}</div>
        <div className="partner-reveal-overlay__body">{bodyCopy}</div>

        <div className="partner-reveal-overlay__summary">
          {roleImageSrc ? (
            <img
              className="partner-reveal-overlay__image"
              src={roleImageSrc}
              alt={roleLabel}
              draggable={false}
            />
          ) : null}
          <div className="partner-reveal-overlay__role-chip">{roleLabel}</div>
        </div>

        <div className="partner-reveal-overlay__list" aria-label="Partner names">
          {partnerNames.map((partnerName) => (
            <div key={partnerName} className="partner-reveal-overlay__partner">
              {partnerName}
            </div>
          ))}
        </div>

        <button
          type="button"
          className="partner-reveal-overlay__continue"
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
