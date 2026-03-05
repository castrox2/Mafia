import React from "react"

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
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 11000,
      }}
    >
      <div
        style={{
          width: "min(680px, 100%)",
          maxHeight: "80vh",
          overflowY: "auto",
          background: "white",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            fontSize: 16,
          }}
          aria-label="Close role info"
          title="Close"
        >
          X
        </button>

        <h2 style={{ marginTop: 0, marginBottom: 8 }}>{roleName}</h2>
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            color: "#222",
            whiteSpace: "pre-wrap",
          }}
        >
          {description}
        </div>
      </div>
    </div>
  )
}
