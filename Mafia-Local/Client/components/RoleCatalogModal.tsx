import React, { useEffect, useState } from "react"
import type { BotcScriptSummaryPayload, RoleSelectorScriptMode } from "../../Shared/events.js"
import { getRoleLabel } from "../src/uiMeta.js"
import { getBotcRoleInfo } from "../src/constants/botcRoleInfo.js"
import RoleInfoModal from "./RoleInfoModal.js"

type Props = {
  open: boolean
  scriptMode: RoleSelectorScriptMode
  botcScriptSummary: BotcScriptSummaryPayload | null
  onClose: () => void
}

type RoleGroupSection = {
  key: string
  title: string
  roles: string[]
}

const REGULAR_MAFIA_ROLES: string[] = [
  getRoleLabel("CIVILIAN"),
  getRoleLabel("DOCTOR"),
  getRoleLabel("DETECTIVE"),
  getRoleLabel("SHERIFF"),
  getRoleLabel("MAFIA"),
]

const toBotcGroups = (
  summary: BotcScriptSummaryPayload | null
): RoleGroupSection[] => {
  if (!summary) return []

  return [
    { key: "townsfolk", title: "Townsfolk", roles: summary.groupedRoleIds.townsfolk },
    { key: "outsiders", title: "Outsiders", roles: summary.groupedRoleIds.outsiders },
    { key: "minions", title: "Minions", roles: summary.groupedRoleIds.minions },
    { key: "demons", title: "Demons", roles: summary.groupedRoleIds.demons },
    { key: "others", title: "Other / Unclassified", roles: summary.groupedRoleIds.others },
  ].filter((section) => section.roles.length > 0)
}

export default function RoleCatalogModal({
  open,
  scriptMode,
  botcScriptSummary,
  onClose,
}: Props) {
  const [selectedRoleInfo, setSelectedRoleInfo] = useState<{
    roleName: string
    description: string
  } | null>(null)

  useEffect(() => {
    if (!open) setSelectedRoleInfo(null)
  }, [open])

  if (!open) return null

  const groups =
    scriptMode === "REGULAR_MAFIA" ? [] : toBotcGroups(botcScriptSummary)

  const openRoleInfo = (roleId: string) => {
    const info = getBotcRoleInfo(roleId)
    if (info) {
      setSelectedRoleInfo(info)
      return
    }

    setSelectedRoleInfo({
      roleName: roleId,
      description: `No description available yet for "${roleId}".`,
    })
  }

  const getRoleDisplayName = (roleId: string): string =>
    getBotcRoleInfo(roleId)?.roleName ?? roleId

  const closeCatalog = () => {
    setSelectedRoleInfo(null)
    onClose()
  }

  return (
    <>
      <div
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeCatalog()
        }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          zIndex: 10000,
        }}
      >
        <div
          style={{
            width: "min(760px, 100%)",
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
            onClick={closeCatalog}
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
            aria-label="Close role catalog"
            title="Close"
          >
            X
          </button>

          <h2 style={{ marginTop: 0, marginBottom: 4 }}>Available Roles</h2>

          {scriptMode === "BLOOD_ON_THE_CLOCKTOWER" && (
            <div style={{ marginBottom: 10, fontSize: 13, color: "#444" }}>
              Script:{" "}
              {botcScriptSummary
                ? `${botcScriptSummary.name} (${botcScriptSummary.roleCount} roles)`
                : "No script imported"}
            </div>
          )}

          {scriptMode === "REGULAR_MAFIA" ? (
            <section style={{ border: "1px solid #e7e7e7", borderRadius: 10, padding: 10 }}>
              <h3 style={{ margin: "0 0 8px 0" }}>Available</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {REGULAR_MAFIA_ROLES.map((role) => (
                  <li key={`available:${role}`}>{role}</li>
                ))}
              </ul>
            </section>
          ) : groups.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {groups.map((section) => (
                <section
                  key={section.key}
                  style={{ border: "1px solid #e7e7e7", borderRadius: 10, padding: 10 }}
                >
                  <h3 style={{ margin: "0 0 8px 0" }}>{section.title}</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {section.roles.map((role) => (
                      <li key={`${section.key}:${role}`}>
                        <button
                          type="button"
                          onClick={() => openRoleInfo(role)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#0b5ea8",
                            cursor: "pointer",
                            padding: 0,
                            textDecoration: "underline",
                          }}
                        >
                          {getRoleDisplayName(role)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#666" }}>
              {scriptMode === "BLOOD_ON_THE_CLOCKTOWER"
                ? "Import a BOCT script to view grouped roles."
                : "No roles available."}
            </div>
          )}
        </div>
      </div>

      <RoleInfoModal
        open={selectedRoleInfo !== null}
        onClose={() => setSelectedRoleInfo(null)}
        roleName={selectedRoleInfo?.roleName ?? ""}
        description={selectedRoleInfo?.description ?? ""}
      />
    </>
  )
}
