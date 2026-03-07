import type { BotcScriptSummaryPayload } from "../../Shared/events.js"
import { getRoleLabel } from "./uiMeta.js"

export type RoleRollCandidate = {
  label: string
  imageSrc?: string | null
}

const REGULAR_ROLE_IMAGE_BY_KEY: Record<string, string> = {
  MAFIA: "/assets/images/Mafia.png",
  CIVILIAN: "/assets/images/Civillian.png",
  DOCTOR: "/assets/images/Doctor.png",
  DETECTIVE: "/assets/images/Detective.png",
  SHERIFF: "/assets/images/Sheriff.png",
}

const REGULAR_ROLE_KEYS = [
  "MAFIA",
  "CIVILIAN",
  "DOCTOR",
  "DETECTIVE",
  "SHERIFF",
] as const

export const getRegularRoleImageSrc = (
  role: string | null | undefined
): string | null => {
  const key = String(role || "").trim().toUpperCase()
  if (!key) return null
  return REGULAR_ROLE_IMAGE_BY_KEY[key] ?? null
}

export const getRegularRoleRollCandidates = (): RoleRollCandidate[] => {
  return REGULAR_ROLE_KEYS.map((roleKey) => ({
    label: getRoleLabel(roleKey),
    imageSrc: REGULAR_ROLE_IMAGE_BY_KEY[roleKey] ?? null,
  }))
}

export const getBotcRoleRollCandidates = (
  summary: BotcScriptSummaryPayload | null | undefined
): RoleRollCandidate[] => {
  const roleIds = Array.isArray(summary?.roleIds) ? summary?.roleIds ?? [] : []
  if (roleIds.length <= 0) return []
  return roleIds.map((roleId) => ({
    label: String(roleId || "").trim(),
  }))
}
