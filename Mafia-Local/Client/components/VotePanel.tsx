import React from "react"
import "../src/styles/components/vote-panel.css"

export type VotePanelTarget = {
  clientId: string
  name: string
  subtitle?: string
  iconSrc?: string
  iconAlt?: string
  disabled?: boolean
}

type Props = {
  title: string
  description?: string
  targets: VotePanelTarget[]
  actionLabel: string
  emptyLabel?: string
  skipLabel?: string
  disabled?: boolean
  className?: string
  onSelect: (targetClientId: string) => void
  onSkip?: () => void
}

export default function VotePanel({
  title,
  description,
  targets,
  actionLabel,
  emptyLabel = "No available targets right now.",
  skipLabel,
  disabled = false,
  className,
  onSelect,
  onSkip,
}: Props) {
  return (
    <section className={["vote-panel", className].filter(Boolean).join(" ")}>
      <div className="vote-panel__header">
        <h3 className="vote-panel__title">{title}</h3>
        {description ? <p className="vote-panel__description">{description}</p> : null}
      </div>

      {targets.length <= 0 ? (
        <div className="vote-panel__empty">{emptyLabel}</div>
      ) : (
        <div className="vote-panel__list">
          {targets.map((target) => (
            <button
              key={target.clientId}
              type="button"
              className="vote-panel__target"
              disabled={disabled || target.disabled === true}
              onClick={() => onSelect(target.clientId)}
            >
              <span className="vote-panel__target-copy">
                <span className="vote-panel__target-name-row">
                  <span className="vote-panel__target-name">{target.name}</span>
                  {target.iconSrc ? (
                    <img
                      className="vote-panel__target-icon"
                      src={target.iconSrc}
                      alt={target.iconAlt ?? ""}
                      onError={(event) => {
                        event.currentTarget.style.display = "none"
                      }}
                    />
                  ) : null}
                </span>
                {target.subtitle ? (
                  <span className="vote-panel__target-subtitle">{target.subtitle}</span>
                ) : null}
              </span>
              <span className="vote-panel__target-action">{actionLabel}</span>
            </button>
          ))}
        </div>
      )}

      {onSkip && skipLabel ? (
        <div className="vote-panel__actions">
          <button
            type="button"
            className="vote-panel__skip"
            disabled={disabled}
            onClick={onSkip}
          >
            {skipLabel}
          </button>
        </div>
      ) : null}
    </section>
  )
}
