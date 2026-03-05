import React from "react"
import "../src/styles/components/role-catalog-modal.css"

type Props = {
  open: boolean
  roleName: string
  description: string
  onClose: () => void
}

export default function RoleInfoModal({
  open,
  roleName,
  description,
  onClose,
}: Props) {
  if (!open) return null

  return (
    <div
      className="role-info-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="role-info-panel">
        <button
          onClick={onClose}
          className="role-info-close"
          aria-label="Close role info"
          title="Close"
          type="button"
        >
          X
        </button>

        <h2 className="role-info-title">{roleName}</h2>
        <div className="role-info-description">{description}</div>
      </div>
    </div>
  )
}
