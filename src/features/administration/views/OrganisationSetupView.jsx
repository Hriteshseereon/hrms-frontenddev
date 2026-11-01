import { useState, useEffect, useRef } from "react";
import { useRouter } from "@/lib/router";
import Link from "@/lib/router";
import {
  Building2,
  Check,
  ArrowLeft,
  Save,
  Loader2,
  Landmark,
  Mail,
  Phone,
  MapPin,
  Globe,
  UploadCloud,
  X,
  Layers,
  GitBranch,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCurrentTenant, updateTenant } from "@/features/organization/data/tenancy";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { organizationApi } from "@/api/organizationApi";
import { uploadApi } from "@/api/uploadApi";

export default function OrganisationSetupView() {
  const me = useCurrentUser();
  const tenant = useCurrentTenant();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Form Fields
  const [name, setName] = useState(tenant?.name || "");
  const [legalName, setLegalName] = useState(tenant?.legalName || "");
  const [email, setEmail] = useState(tenant?.contact?.email || "");
  const [phone, setPhone] = useState(tenant?.contact?.phone || "");
  const [website, setWebsite] = useState(tenant?.website || "");
  const [logoUrl, setLogoUrl] = useState(tenant?.logo_url || "");
  const [gstin, setGstin] = useState(tenant?.gstin || "");
  const [pan, setPan] = useState(tenant?.pan || "");
  const [address, setAddress] = useState(tenant?.address || "");
  const [city, setCity] = useState(tenant?.city || "");
  const [state, setState] = useState(tenant?.state || "");
  const [pincode, setPincode] = useState(tenant?.pincode || "");
  const [country, setCountry] = useState(tenant?.country || "India");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchOrg = async () => {
      try {
        setLoading(true);
        const data = await organizationApi.getOrganization();
        if (mounted && data) {
          if (data.name) setName(data.name);
          if (data.legal_name || data.legalName) setLegalName(data.legal_name || data.legalName);
          if (data.contact_email || data.official_email || data.email) {
            setEmail(data.contact_email || data.official_email || data.email);
          }
          if (data.contact_phone || data.phone) setPhone(data.contact_phone || data.phone);
          if (data.website) setWebsite(data.website);
          if (data.logo_url) setLogoUrl(data.logo_url);
          if (data.gst_no || data.gstin) setGstin(data.gst_no || data.gstin);
          if (data.pan_no || data.pan) setPan(data.pan_no || data.pan);
          if (data.address) setAddress(data.address);
          if (data.city) setCity(data.city);
          if (data.state) setState(data.state);
          if (data.pincode) setPincode(data.pincode);
          if (data.country) setCountry(data.country);
          if (data.stats) setStats(data.stats);
        }
      } catch {
        // Fallback to local
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchOrg();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, SVG, WebP)");
      return;
    }

    try {
      setUploadingLogo(true);
      const url = await uploadApi.uploadFile(file, "organisation");
      setLogoUrl(url);
      toast.success("Logo uploaded successfully");
    } catch (err) {
      console.error("Logo upload error:", err);
      // Fallback: create object URL for preview if upload fails in dev
      const localPreview = URL.createObjectURL(file);
      setLogoUrl(localPreview);
      toast.warning("File upload API not reachable. Using local preview.");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Organisation display name is required");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        legal_name: legalName.trim() || name.trim(),
        legalName: legalName.trim() || name.trim(),
        contact_email: email.trim(),
        official_email: email.trim(),
        email: email.trim(),
        contact_phone: phone.trim(),
        phone: phone.trim(),
        website: website.trim(),
        logo_url: logoUrl,
        gst_no: gstin.trim(),
        gstin: gstin.trim(),
        pan_no: pan.trim(),
        pan: pan.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        country: country.trim(),
        contact: {
          name: me.name || "Administrator",
          email: email.trim(),
          phone: phone.trim(),
        },
      };

      await organizationApi.saveOrganization(payload);

      // Update local tenant store for instant reactive updates across top-bar & cards
      if (tenant?.id) {
        updateTenant(tenant.id, payload);
      }

      toast.success(`Organisation "${name}" saved successfully`);
      router.push("/org/groups");
    } catch {
      toast.error("Failed to save organisation details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Building2 className="text-primary h-6 w-6" /> Organisation Profile &amp; Setup
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure your root holding organisation. Companies and branches are managed in Companies &amp; Branches.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/org/groups">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Companies &amp; Branches
          </Link>
        </Button>
      </div>

      {/* Live Stats Overview Card if returned by backend */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="bg-card/50 border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total_companies ?? 0}</div>
                <div className="text-xs text-muted-foreground">Active Companies</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total_branches ?? 0}</div>
                <div className="text-xs text-muted-foreground">Operating Branches</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total_employees ?? 0}</div>
                <div className="text-xs text-muted-foreground">Total Employees</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Organisation Brand & Identity */}
          <Card className="shadow-card">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Landmark className="h-4 w-4 text-primary" /> Identity &amp; Legal Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              {/* Logo Upload Section */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-dashed border-border bg-muted/20">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-background flex items-center justify-center shadow-sm">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Organisation Logo" className="h-full w-full object-contain p-1" />
                  ) : (
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  )}
                  {uploadingLogo && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 flex-1">
                  <div className="text-sm font-semibold">Organisation Logo &amp; Brand</div>
                  <p className="text-xs text-muted-foreground">
                    Upload your holding company logo (PNG, JPG, or SVG, max 5MB). This logo is displayed in headers and payslips.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingLogo}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
                      {logoUrl ? "Change Logo" : "Upload Logo"}
                    </Button>
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setLogoUrl("")}
                      >
                        <X className="h-3.5 w-3.5 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Organisation Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Seereon Group of Companies"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    This root name appears across the top bar and holding group cards.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Legal / Registered Name</Label>
                  <Input
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="e.g. Seereon Global Technologies Pvt Ltd"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Official name used for enterprise documentation and filings.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">GSTIN (GST Number)</Label>
                  <Input
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 27AAACS1234A1Z5"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">PAN Number</Label>
                  <Input
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    placeholder="e.g. AAACS1234A"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact & Digital Details */}
          <Card className="shadow-card">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" /> Official Contact &amp; Web
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Official Contact Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@seereon.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Contact Phone Number</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Website URL</Label>
                  <Input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://seereon.co.in"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Registered Address */}
          <Card className="shadow-card">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Registered Headquarters Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Headquarters Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="401, Tech Park, IT Corridor"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">City</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bhubaneswar"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">State / Region</Label>
                  <Input
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Odisha"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">PIN Code</Label>
                  <Input
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="751024"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Country</Label>
                  <Input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="India"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button asChild variant="outline">
              <Link href="/org/groups">Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={saving || !name.trim()}
              className="bg-gradient-emerald shadow-premium text-white"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Save Organisation Setup
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
