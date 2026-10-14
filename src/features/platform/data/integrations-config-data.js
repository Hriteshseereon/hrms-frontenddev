// ---------------------------------------------------------------------------
// Integration configuration — SSO, Active Directory, biometric device
// registry, and email-to-ticket. These are UI-only configuration screens:
// the actual external handshake (a real IdP, a real AD sync, real device
// network access, a real mail server webhook) is out of scope for a
// UI-only build and needs a genuine backend integration. What's real here
// is the configuration data itself and its persistence — an org admin can
// fill these in and see them saved, ready for a backend to consume later.
// ---------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";

/* --------------------------------- SSO ------------------------------------ */

/**
 * @typedef {Object} SsoConfig
 * @property {boolean} enabled
 * @property {"SAML" | "OIDC" | ""} provider
 * @property {string} idpMetadataUrl
 * @property {string} domain
 * @property {boolean} autoLoginForDomain
 * @property {string} [lastTestedOn]
 * @property {"Not connected" | "Success" | "Failed"} [lastTestResult]
 */

export const DEFAULT_SSO_CONFIG = {
  enabled: false,
  provider: "",
  idpMetadataUrl: "",
  domain: "",
  autoLoginForDomain: false,
  lastTestResult: "Not connected",
};

export const ssoConfigStore = createPersistentStore("seereon.integrations.sso", {});
export const useSsoConfig = (orgId) => {
  const all = ssoConfigStore.use();
  return all[orgId] ?? DEFAULT_SSO_CONFIG;
};
export const saveSsoConfig = (orgId, config) =>
  ssoConfigStore.set((p) => ({ ...p, [orgId]: config }));

/* ---------------------------- Active Directory ----------------------------- */

/**
 * @typedef {Object} AdConfig
 * @property {boolean} enabled
 * @property {string} domainController
 * @property {"All users" | "Selected OUs" | ""} syncScope
 * @property {{ adAttribute: string, hrmsField: string }[]} fieldMapping
 * @property {string} [lastSyncedOn]
 */

export const DEFAULT_AD_CONFIG = {
  enabled: false,
  domainController: "",
  syncScope: "",
  fieldMapping: [
    { adAttribute: "sAMAccountName", hrmsField: "Employee ID" },
    { adAttribute: "mail", hrmsField: "Work email" },
    { adAttribute: "department", hrmsField: "Department" },
  ],
};

export const adConfigStore = createPersistentStore("seereon.integrations.ad", {});
export const useAdConfig = (orgId) => {
  const all = adConfigStore.use();
  return all[orgId] ?? DEFAULT_AD_CONFIG;
};
export const saveAdConfig = (orgId, config) =>
  adConfigStore.set((p) => ({ ...p, [orgId]: config }));

/* ---------------------------- Biometric devices ----------------------------- */

/**
 * @typedef {Object} BiometricDevice
 * @property {string} id
 * @property {string} name
 * @property {string} branch
 * @property {string} deviceModel
 * @property {string} serialNumber
 * @property {"Registered" | "Pending OEM Setup" | "Offline"} status
 */

export const biometricDeviceStore = createPersistentStore("seereon.integrations.biometric", {});
export const useBiometricDevices = (orgId) => {
  const all = biometricDeviceStore.use();
  return all[orgId] ?? [];
};

export function registerBiometricDevice(orgId, input) {
  const device = {
    ...input,
    id: `DEV-${Date.now()}`,
    status: "Pending OEM Setup",
  };
  biometricDeviceStore.set((p) => ({ ...p, [orgId]: [device, ...(p[orgId] ?? [])] }));
  return device;
}

export const removeBiometricDevice = (orgId, deviceId) =>
  biometricDeviceStore.set((p) => ({
    ...p,
    [orgId]: (p[orgId] ?? []).filter((d) => d.id !== deviceId),
  }));

/* ---------------------------- Email-to-ticket ----------------------------- */

/**
 * @typedef {Object} EmailTicketConfig
 * @property {boolean} enabled
 * @property {string} inboxAddress
 * @property {string} routingKeyword
 */

export const DEFAULT_EMAIL_TICKET_CONFIG = {
  enabled: false,
  inboxAddress: "",
  routingKeyword: "",
};

export const emailTicketConfigStore = createPersistentStore(
  "seereon.integrations.email-ticket",
  {},
);
export const useEmailTicketConfig = (orgId) => {
  const all = emailTicketConfigStore.use();
  return all[orgId] ?? DEFAULT_EMAIL_TICKET_CONFIG;
};
export const saveEmailTicketConfig = (orgId, config) =>
  emailTicketConfigStore.set((p) => ({ ...p, [orgId]: config }));
