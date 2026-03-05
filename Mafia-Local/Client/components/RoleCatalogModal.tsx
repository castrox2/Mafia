import React, { useEffect, useState } from "react"
import type { BotcScriptSummaryPayload, RoleSelectorScriptMode } from "../../Shared/events.js"
import { getRoleLabel } from "../src/uiMeta.js"
import { getBotcRoleInfo } from "../src/constants/botcRoleInfo.js"
import RoleInfoModal from "./RoleInfoModal.js"
import "../src/styles/components/role-catalog-modal.css"

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
        className="role-catalog-overlay"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeCatalog()
        }}
      >
        <div className="role-catalog-panel">
          <button
            onClick={closeCatalog}
            className="role-catalog-close"
            aria-label="Close role catalog"
            title="Close"
            type="button"
          >
            X
          </button>

          <h2 className="role-catalog-title">Available Roles</h2>

          {scriptMode === "BLOOD_ON_THE_CLOCKTOWER" && (
            <div className="role-catalog-subtitle">
              Script:{" "}
              {botcScriptSummary
                ? `${botcScriptSummary.name} (${botcScriptSummary.roleCount} roles)`
                : "No script imported"}
            </div>
          )}

          {scriptMode === "REGULAR_MAFIA" ? (
            <section className="role-catalog-section">
              <h3 className="role-catalog-section-title">Available</h3>
              <ul className="role-catalog-list">
                {REGULAR_MAFIA_ROLES.map((role) => (
                  <li key={`available:${role}`} className="role-catalog-list-item">
                    {role}
                  </li>
                ))}
              </ul>
            </section>
          ) : groups.length > 0 ? (
            <div className="role-catalog-grid">
              {groups.map((section) => (
                <section key={section.key} className="role-catalog-section">
                  <h3 className="role-catalog-section-title">{section.title}</h3>
                  <ul className="role-catalog-list">
                    {section.roles.map((role) => (
                      <li key={`${section.key}:${role}`} className="role-catalog-list-item">
                        <button
                          type="button"
                          onClick={() => openRoleInfo(role)}
                          className="role-catalog-role-button"
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
            <div className="role-catalog-empty">
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
