// Configuration screens for external integrations this UI-only prototype
// can't actually connect to. Every dialog here clearly states that live
// integration is pending — what's real is the configuration data itself,
// saved and ready for a backend to consume.
import { useState } from "react";
import { KeyRound, Network, Fingerprint, Mail, Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSsoConfig,
  saveSsoConfig,
  useAdConfig,
  saveAdConfig,
  useBiometricDevices,
  registerBiometricDevice,
  removeBiometricDevice,
  useEmailTicketConfig,
  saveEmailTicketConfig,
} from "@/features/platform/data/integrations-config-data";

function PendingNotice({ text }) {
  return (
    <div className="border-gold/30 bg-gold/10 text-gold flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

export function SsoConfigDialog({ orgId }) {
  const config = useSsoConfig(orgId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);
  // Enabling SSO without an IdP and a domain would lock every sign-in behind a provider that is not configured.
  const incomplete =
    draft.enabled &&
    (!draft.provider ||
      !/^https?:\/\/\S+/.test(draft.idpMetadataUrl.trim()) ||
      !draft.domain.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(config);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Configure
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="text-primary h-4 w-4" /> Single Sign-On
          </DialogTitle>
          <DialogDescription>SAML / OIDC configuration for this organisation.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <PendingNotice text="This saves your SSO configuration. Completing the real IdP handshake requires IT to finish the integration separately." />
          <div className="flex items-center justify-between">
            <Label className="text-sm">Enable SSO</Label>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) => setDraft((p) => ({ ...p, enabled: v }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Provider</Label>
            <Select
              value={draft.provider}
              onValueChange={(v) => setDraft((p) => ({ ...p, provider: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SAML">SAML 2.0</SelectItem>
                <SelectItem value="OIDC">OpenID Connect</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">IdP metadata URL</Label>
            <Input
              value={draft.idpMetadataUrl}
              onChange={(e) => setDraft((p) => ({ ...p, idpMetadataUrl: e.target.value }))}
              placeholder="https://idp.example.com/metadata"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Domain</Label>
            <Input
              value={draft.domain}
              onChange={(e) => setDraft((p) => ({ ...p, domain: e.target.value }))}
              placeholder="company.com"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Auto-login for this domain</Label>
            <Switch
              checked={draft.autoLoginForDomain}
              onCheckedChange={(v) => setDraft((p) => ({ ...p, autoLoginForDomain: v }))}
            />
          </div>
          <div className="border-border flex items-center justify-between rounded-lg border px-3 py-2">
            <span className="text-muted-foreground text-xs">Connection status</span>
            <Badge variant="outline">{draft.lastTestResult ?? "Not connected"}</Badge>
          </div>
        </div>
        {incomplete && (
          <p className="text-destructive text-xs">
            To enable SSO, choose the provider and enter a valid IdP metadata URL (https://…) and
            the sign-in domain.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-emerald text-white"
            disabled={incomplete}
            onClick={() => {
              saveSsoConfig(orgId, draft);
              toast.success("SSO configuration saved");
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * @typedef {"All users" | "Selected OUs" | ""} AdSyncScope
 */

export function AdConfigDialog({ orgId }) {
  const config = useAdConfig(orgId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);
  // A sync cannot be switched on without a directory to sync from.
  const incomplete = draft.enabled && (!draft.domainController.trim() || !draft.syncScope);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(config);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Configure
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="text-primary h-4 w-4" /> Active Directory Integration
          </DialogTitle>
          <DialogDescription>
            Sync employee records from your on-prem or Azure AD.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <PendingNotice text="This saves your AD sync configuration. IT needs to complete the real directory sync separately." />
          <div className="flex items-center justify-between">
            <Label className="text-sm">Enable AD sync</Label>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) => setDraft((p) => ({ ...p, enabled: v }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Domain controller</Label>
            <Input
              value={draft.domainController}
              onChange={(e) => setDraft((p) => ({ ...p, domainController: e.target.value }))}
              placeholder="dc01.company.local"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Sync scope</Label>
            <Select
              value={draft.syncScope}
              onValueChange={(v) => setDraft((p) => ({ ...p, syncScope: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All users">All users</SelectItem>
                <SelectItem value="Selected OUs">Selected OUs</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Field mapping</Label>
            {draft.fieldMapping.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="font-mono">
                  {m.adAttribute}
                </Badge>
                <span className="text-muted-foreground">→</span>
                <span>{m.hrmsField}</span>
              </div>
            ))}
          </div>
        </div>
        {incomplete && (
          <p className="text-destructive text-xs">
            Enter the domain controller and pick a sync scope before enabling AD sync.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-emerald text-white"
            disabled={incomplete}
            onClick={() => {
              saveAdConfig(orgId, draft);
              toast.success("AD configuration saved");
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BiometricDevicesDialog({ orgId, branches }) {
  const devices = useBiometricDevices(orgId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [branch, setBranch] = useState(branches[0] ?? "");
  const [deviceModel, setDeviceModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Configure
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fingerprint className="text-primary h-4 w-4" /> Biometric Device Registry
          </DialogTitle>
          <DialogDescription>
            Register physical shift-tracking devices per branch.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <PendingNotice text="OEM discussion for shift-tracking hardware is still pending, per the client's own MoM. Devices registered here are ready to be wired up once that's finalised." />

          <div className="space-y-2">
            {devices.length === 0 && (
              <p className="text-muted-foreground text-xs">No devices registered yet.</p>
            )}
            {devices.map((d) => (
              <div
                key={d.id}
                className="border-border flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {d.branch} · {d.deviceModel} · {d.serialNumber}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{d.status}</Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 sm:h-7 sm:w-7"
                    onClick={() => {
                      removeBiometricDevice(orgId, d.id);
                      toast.success("Device removed");
                    }}
                  >
                    <Trash2 className="text-muted-foreground h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-border space-y-2 rounded-lg border p-3">
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Register a device
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Device name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8"
              />
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Model"
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                className="h-8"
              />
              <Input
                placeholder="Serial number"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="h-8"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!name.trim() || !deviceModel.trim()}
              onClick={() => {
                registerBiometricDevice(orgId, {
                  name: name.trim(),
                  branch,
                  deviceModel: deviceModel.trim(),
                  serialNumber: serialNumber.trim(),
                });
                toast.success("Device registered");
                setName("");
                setDeviceModel("");
                setSerialNumber("");
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Add device
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmailTicketConfigDialog({ orgId }) {
  const config = useEmailTicketConfig(orgId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);
  // Routing cannot be switched on without a mailbox to read from.
  const incomplete = draft.enabled && !/^\S+@\S+\.\S+$/.test(draft.inboxAddress.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(config);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Configure
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="text-primary h-4 w-4" /> Email-to-Ticket
          </DialogTitle>
          <DialogDescription>
            Support inbox address and routing for inbound email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <PendingNotice text="This saves your inbox routing configuration. Live inbound email parsing requires a mail server webhook that isn't part of this build." />
          <div className="flex items-center justify-between">
            <Label className="text-sm">Enable email-to-ticket</Label>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) => setDraft((p) => ({ ...p, enabled: v }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Support inbox address</Label>
            <Input
              value={draft.inboxAddress}
              onChange={(e) => setDraft((p) => ({ ...p, inboxAddress: e.target.value }))}
              placeholder="support@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Subject routing keyword</Label>
            <Input
              value={draft.routingKeyword}
              onChange={(e) => setDraft((p) => ({ ...p, routingKeyword: e.target.value }))}
              placeholder="e.g. [Ticket]"
            />
          </div>
        </div>
        {incomplete && (
          <p className="text-destructive text-xs">
            Enter a valid support inbox address before enabling email-to-ticket.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-emerald text-white"
            disabled={incomplete}
            onClick={() => {
              saveEmailTicketConfig(orgId, draft);
              toast.success("Email routing saved");
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
