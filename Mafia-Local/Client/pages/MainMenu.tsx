import React from "react"

type Props = {
  onSelectPlayGame: () => void
  onSelectRoleAssigner: () => void
}

export default function MainMenu({
  onSelectPlayGame,
  onSelectRoleAssigner,
}: Props) {
  const menuButtonStyle: React.CSSProperties = {
    width: "100%",
    textAlign: "left",
    border: "1px solid #d4d7de",
    borderRadius: 12,
    padding: "14px 16px",
    background: "#ffffff",
    cursor: "pointer",
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background:
          "linear-gradient(140deg, #f4f7fb 0%, #eef3f7 50%, #f8fafc 100%)",
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          border: "1px solid #e6e8ee",
          borderRadius: 16,
          padding: 18,
          background: "#fff",
          boxShadow: "0 10px 30px rgba(26,34,48,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <img
            src="/assets/Mafia-Icon.png"
            alt="Mafia logo"
            style={{ width: 56, height: 56, objectFit: "contain" }}
            onError={(event) => {
              event.currentTarget.style.display = "none"
            }}
          />
          <div>
            <h1 style={{ margin: 0 }}>Mafia</h1>
            <div style={{ marginTop: 4, color: "#4b5563", fontSize: 14 }}>
              Choose what you want to do.
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <button
            type="button"
            onClick={onSelectPlayGame}
            style={menuButtonStyle}
            title="Create or join a classic game room"
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Play Game</div>
            <div style={{ fontSize: 13, color: "#5b6472", marginTop: 4 }}>
              Create or join a regular Mafia game room.
            </div>
          </button>

          <button
            type="button"
            onClick={onSelectRoleAssigner}
            style={menuButtonStyle}
            title="Create or join a role assignment room"
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Role Assigner</div>
            <div style={{ fontSize: 13, color: "#5b6472", marginTop: 4 }}>
              Create or join a room focused on role assignment.
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
