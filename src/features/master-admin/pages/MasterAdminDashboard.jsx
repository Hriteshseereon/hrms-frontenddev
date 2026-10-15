
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Layers,
  Plus,
  Pencil,
  Eye,
  Trash2,
  LogOut,
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  getModules,
  getModule,
  createModule,
  updateModule,
  deleteModuleApi,
  getSubModules,
  getSubModule,
  createSubModule,
  updateSubModule,
  deleteSubModuleApi,
} from "@/api/MasterAdmin_modules";

const emptyModule = {
  name: "",
  code: "",
  icon: "",
  iconType: "url",
  pathName: "",
  description: "",
  display_order: 0,
  is_active: true,
};

const emptySubModule = {
  moduleId: "",
  name: "",
  code: "",
  icon: "",
  iconType: "url",
  pathName: "",
  description: "",
  display_order: 0,
  is_active: true,
};

// Convert FastAPI errors into text that React can safely display.
const getApiErrorMessage = (error, fallback = "Something went wrong.") => {
  const detail = error?.response?.data?.detail;
  const message = error?.response?.data?.message;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const location = Array.isArray(item.loc)
            ? item.loc.filter((part) => part !== "body").join(" → ")
            : "";

          return location
            ? `${location}: ${item.msg || "Invalid input"}`
            : item.msg || "Invalid input";
        }
        return String(item);
      })
      .join("; ");
  }

  if (typeof detail === "string") return detail;
  if (typeof message === "string") return message;

  if (typeof error?.message === "string") {
    return error.message;
  }

  return fallback;
};

// Normalize backend records while preserving the existing UI field names.
const normalizeItem = (item = {}, isSubModule = false) => ({
  ...item,

  id:
    item.id ??
    (isSubModule ? item.submodule_id : item.module_id) ??
    item.module_id ??
    item.submodule_id,

  moduleId:
    item.moduleId ??
    item.parent_module_id ??
    item.module_id ??
    "",

  name: item.name ?? "",
  code: item.code ?? "",
  icon: item.icon ?? item.icon_url ?? "",
  iconType: item.iconType ?? item.icon_type ?? "url",

  pathName:
    item.pathName ??
    item.path ??
    item.path_name ??
    "",

  description: item.description ?? "",
  display_order: item.display_order ?? 0,
  is_active: item.is_active ?? true,
});

// Build a payload matching the module POST schema from Swagger.
// Keep UUID IDs as strings; do not convert them to numbers.
const makePayload = (form, isSubModule = false) => {
  const generatedCode =
    form.code?.trim() ||
    form.name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const payload = {
    name: form.name.trim(),
    code: generatedCode,
    icon: form.icon || "",
    path: form.pathName.trim(),
    description: form.description.trim(),
    display_order: Number(form.display_order) || 0,
    is_active: form.is_active ?? true,
  };

  // The exact submodule schema must be confirmed in Swagger.
  if (isSubModule) {
    payload.module_id = form.moduleId;
  }

  return payload;
};

function IconPreview({ item }) {
  const icon =
    typeof item?.icon === "string" ? item.icon : "";

  if (!icon) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-green-50 text-green-700">
        <ImageIcon size={19} />
      </div>
    );
  }

  if (
    icon.startsWith("http://") ||
    icon.startsWith("https://") ||
    icon.startsWith("data:image/")
  ) {
    return (
      <img
        src={icon}
        alt={item.name || "Icon"}
        className="h-10 w-10 rounded-md border object-contain p-1"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-green-50 text-green-700">
      <span className="max-w-full truncate text-xs font-semibold">
        {icon}
      </span>
    </div>
  );
}

export default function MasterAdminDashboard() {
  const navigate = useNavigate();

  const [activePage, setActivePage] = useState("Dashboard");
  const [modules, setModules] = useState([]);
  const [subModules, setSubModules] = useState([]);

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyModule);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isView =
    modal === "viewModule" || modal === "viewSubModule";

  const isSubModule =
    modal === "submodule" || modal === "viewSubModule";

  // Fetch both lists from the backend.
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [moduleData, subModuleData] = await Promise.all([
        getModules(),
        getSubModules(),
      ]);

      setModules(
        moduleData.map((item) => normalizeItem(item, false))
      );

      setSubModules(
        subModuleData.map((item) => normalizeItem(item, true))
      );
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Unable to load modules and submodules."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      navigate("/master-admin/login", { replace: true });
      return;
    }

    loadData();
  }, [navigate, loadData]);

  const closeModal = () => {
    setModal(null);
    setEditingId(null);
    setError("");
  };

  const resetForm = (value) => {
    setForm({ ...value });
    setEditingId(null);
    setError("");
  };

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  // MODULE: open add form.
  const openAddModule = () => {
    resetForm(emptyModule);
    setModal("module");
  };

  // MODULE: fetch the latest record before viewing/editing.
  const openModule = async (item, mode) => {
    setError("");

    try {
      const response = await getModule(item.id);
      const latest = normalizeItem(response, false);

      setForm({
        ...emptyModule,
        ...latest,
      });

      setEditingId(mode === "edit" ? item.id : null);
      setModal(mode === "view" ? "viewModule" : "module");
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Unable to load module details.")
      );
    }
  };

  // MODULE: create or update.
  const saveModule = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.pathName.trim()) {
      setError("Name and Path Name are required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = makePayload(form, false);

      if (editingId !== null) {
        await updateModule(editingId, payload);
      } else {
        await createModule(payload);
      }

      closeModal();
      await loadData();
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Unable to save module.")
      );
    } finally {
      setSaving(false);
    }
  };

  // MODULE: delete.
  const deleteModule = async (item) => {
    const hasChildren = subModules.some(
      (sub) => String(sub.moduleId) === String(item.id)
    );

    const message = hasChildren
      ? `Delete "${item.name}" and its submodules?`
      : `Delete module "${item.name}"?`;

    if (!window.confirm(message)) return;

    setError("");

    try {
      await deleteModuleApi(item.id);
      await loadData();
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Unable to delete module. Check whether it has submodules."
        )
      );
    }
  };

  // SUBMODULE: open add form.
  const openAddSubModule = () => {
    resetForm(emptySubModule);
    setModal("submodule");
  };

  // SUBMODULE: fetch latest record before viewing/editing.
  const openSubModule = async (item, mode) => {
    setError("");

    try {
      const response = await getSubModule(item.id);
      const latest = normalizeItem(response, true);

      setForm({
        ...emptySubModule,
        ...latest,
        moduleId: String(latest.moduleId || ""),
      });

      setEditingId(mode === "edit" ? item.id : null);
      setModal(
        mode === "view" ? "viewSubModule" : "submodule"
      );
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Unable to load submodule details."
        )
      );
    }
  };

  // SUBMODULE: create or update.
  const saveSubModule = async (event) => {
    event.preventDefault();

    if (
      !form.moduleId ||
      !form.name.trim() ||
      !form.pathName.trim()
    ) {
      setError("Module, Name, and Path Name are required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = makePayload(form, true);

      if (editingId !== null) {
        await updateSubModule(editingId, payload);
      } else {
        await createSubModule(payload);
      }

      closeModal();
      await loadData();
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Unable to save submodule.")
      );
    } finally {
      setSaving(false);
    }
  };

  // SUBMODULE: delete.
  const deleteSubModule = async (item) => {
    if (!window.confirm(`Delete submodule "${item.name}"?`)) {
      return;
    }

    setError("");

    try {
      await deleteSubModuleApi(item.id);
      await loadData();
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Unable to delete submodule.")
      );
    }
  };

  const getModuleName = (moduleId) =>
    modules.find(
      (item) => String(item.id) === String(moduleId)
    )?.name || "Unknown module";

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/master-admin/login", { replace: true });
  };

  const matchesSearch = (item, extra = "") =>
    `${item.name} ${item.pathName} ${item.description} ${extra}`
      .toLowerCase()
      .includes(search.toLowerCase());

  const visibleModules = modules.filter((item) =>
    matchesSearch(item)
  );

  const visibleSubModules = subModules.filter((item) =>
    matchesSearch(item, getModuleName(item.moduleId))
  );

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Module", icon: Package },
    { name: "Sub Module", icon: Layers },
  ];

  // Read an image file as a data URL for the existing icon preview.
  const handleIconUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      updateField("icon", String(reader.result || ""));
      updateField("iconType", "file");
    };

    reader.onerror = () => {
      setError("Unable to read the selected image.");
    };

    reader.readAsDataURL(file);
  };

  const renderFormFields = () => (
    <>
      {isSubModule && (
        <div className="space-y-2">
          <Label htmlFor="parentModule">Choose Module *</Label>

          <select
            id="parentModule"
            required
            disabled={isView}
            value={form.moduleId || ""}
            onChange={(event) =>
              updateField("moduleId", event.target.value)
            }
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Select a module</option>

            {modules.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="recordName">Name *</Label>

        <Input
          id="recordName"
          required
          disabled={isView}
          value={form.name || ""}
          onChange={(event) =>
            updateField("name", event.target.value)
          }
          placeholder="Enter name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="recordCode">Code</Label>

        <Input
          id="recordCode"
          disabled={isView}
          value={form.code || ""}
          onChange={(event) =>
            updateField("code", event.target.value)
          }
          placeholder="Auto-generated from name if left blank"
        />

        <p className="text-xs text-slate-500">
          Leave blank to generate a code from the name.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Icon</Label>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={
              form.iconType === "file" ? "default" : "outline"
            }
            disabled={isView}
            onClick={() => updateField("iconType", "file")}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload File
          </Button>

          <Button
            type="button"
            variant={
              form.iconType !== "file" ? "default" : "outline"
            }
            disabled={isView}
            onClick={() => updateField("iconType", "url")}
          >
            <LinkIcon className="mr-2 h-4 w-4" />
            Image URL
          </Button>
        </div>

        {form.iconType === "file" ? (
          <Input
            type="file"
            accept="image/*"
            disabled={isView}
            onChange={handleIconUpload}
          />
        ) : (
          <Input
            type="url"
            disabled={isView}
            value={
              form.icon?.startsWith("data:image/")
                ? ""
                : form.icon || ""
            }
            onChange={(event) =>
              updateField("icon", event.target.value)
            }
            placeholder="https://example.com/icon.png"
          />
        )}

        {form.icon && (
          <div className="flex items-center gap-3 rounded-md border p-3">
            <IconPreview item={form} />
            <span className="text-sm text-slate-500">
              Icon preview
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="pathName">Path *</Label>

        <Input
          id="pathName"
          required
          disabled={isView}
          value={form.pathName || ""}
          onChange={(event) =>
            updateField("pathName", event.target.value)
          }
          placeholder="/example-path"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="recordDescription">Description</Label>

        <Textarea
          id="recordDescription"
          disabled={isView}
          value={form.description || ""}
          onChange={(event) =>
            updateField("description", event.target.value)
          }
          placeholder="Enter description"
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayOrder">Display Order</Label>

        <Input
          id="displayOrder"
          type="number"
          min="0"
          disabled={isView}
          value={form.display_order ?? 0}
          onChange={(event) =>
            updateField(
              "display_order",
              event.target.value === ""
                ? 0
                : Number(event.target.value)
            )
          }
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={isView}
          checked={form.is_active ?? true}
          onChange={(event) =>
            updateField("is_active", event.target.checked)
          }
        />
        Active
      </label>
    </>
  );

  const renderTable = (items, subModule = false) => (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-green-50 text-green-900">
          <tr>
            <th className="p-4">Name</th>
            {subModule && <th className="p-4">Parent Module</th>}
            <th className="p-4">Icon</th>
            <th className="p-4">Path</th>
            <th className="p-4">Description</th>
            <th className="p-4">Status</th>
            <th className="p-4">Actions</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="p-4 font-medium">
                {item.name}
                <div className="mt-1 text-xs text-slate-500">
                  {item.code}
                </div>
              </td>

              {subModule && (
                <td className="p-4">
                  {getModuleName(item.moduleId)}
                </td>
              )}

              <td className="p-4">
                <IconPreview item={item} />
              </td>

              <td className="p-4 font-mono text-xs">
                {item.pathName}
              </td>

              <td className="p-4 text-slate-500">
                {item.description || "—"}
              </td>

              <td className="p-4">
                <span
                  className={
                    item.is_active
                      ? "rounded-full bg-green-50 px-2 py-1 text-xs text-green-700"
                      : "rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
                  }
                >
                  {item.is_active ? "Active" : "Inactive"}
                </span>
              </td>

              <td className="p-4">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="View"
                    onClick={() =>
                      subModule
                        ? openSubModule(item, "view")
                        : openModule(item, "view")
                    }
                  >
                    <Eye className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    title="Edit"
                    onClick={() =>
                      subModule
                        ? openSubModule(item, "edit")
                        : openModule(item, "edit")
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete"
                    className="text-red-700 hover:text-red-800"
                    onClick={() =>
                      subModule
                        ? deleteSubModule(item)
                        : deleteModule(item)
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}

          {items.length === 0 && (
            <tr>
              <td
                colSpan={subModule ? 7 : 6}
                className="p-8 text-center text-slate-500"
              >
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="flex min-h-screen">
        <aside className="flex w-60 shrink-0 flex-col border-r bg-white">
          <div className="border-b px-5 py-6">
            <h1 className="text-xl font-bold text-green-700">
              SEEREON
            </h1>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {[
              { name: "Dashboard", icon: LayoutDashboard },
              { name: "Module", icon: Package },
              { name: "Sub Module", icon: Layers },
            ].map(({ name, icon: Icon }) => (
              <button
                key={name}
                onClick={() => {
                  setActivePage(name);
                  setSearch("");
                  setError("");
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm ${
                  activePage === name
                    ? "bg-green-50 font-semibold text-green-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={18} />
                {name}
              </button>
            ))}
          </nav>

          <button
            onClick={logout}
            className="m-3 flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-600 hover:bg-green-50 hover:text-green-700"
          >
            <LogOut size={18} />
            Logout
          </button>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b bg-white px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold">
                {activePage}
              </h2>
              <p className="text-xs text-slate-500">
                Master Admin / {activePage}
              </p>
            </div>

            <span className="rounded-full bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
              Master Admin
            </span>
          </header>

          <section className="p-6">
            {error && (
              <div
                role="alert"
                className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                <span className="min-w-0 flex-1 break-words">
                  {error}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError("");
                    loadData();
                  }}
                >
                  Retry
                </Button>
              </div>
            )}

            {loading ? (
              <p className="py-10 text-center text-slate-500">
                Loading dashboard data...
              </p>
            ) : (
              <>
                {activePage === "Dashboard" && (
                  <>
                    <h2 className="text-2xl font-bold">
                      Dashboard
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Manage modules and submodules.
                    </p>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border bg-white p-5">
                        <Package className="text-green-700" />
                        <p className="mt-4 text-sm text-slate-500">
                          Total Modules
                        </p>
                        <p className="text-3xl font-bold">
                          {modules.length}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-white p-5">
                        <Layers className="text-green-700" />
                        <p className="mt-4 text-sm text-slate-500">
                          Total Sub Modules
                        </p>
                        <p className="text-3xl font-bold">
                          {subModules.length}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {activePage === "Module" && (
                  <>
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-2xl font-bold">
                        Module Management
                      </h2>

                      <Button
                        onClick={openAddModule}
                        className="bg-green-700 text-white hover:bg-green-800"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Module
                      </Button>
                    </div>

                    <Input
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Search modules..."
                      className="mb-4 max-w-sm bg-white"
                    />

                    {renderTable(visibleModules)}
                  </>
                )}

                {activePage === "Sub Module" && (
                  <>
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-2xl font-bold">
                        Sub Module Management
                      </h2>

                      <Button
                        onClick={openAddSubModule}
                        disabled={modules.length === 0}
                        className="bg-green-700 text-white hover:bg-green-800"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Sub Module
                      </Button>
                    </div>

                    <Input
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Search submodules..."
                      className="mb-4 max-w-sm bg-white"
                    />

                    {renderTable(visibleSubModules, true)}
                  </>
                )}
              </>
            )}
          </section>
        </main>
      </div>

      <Dialog
        open={Boolean(modal)}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isView
                ? "View Details"
                : editingId !== null
                  ? `Edit ${isSubModule ? "Sub Module" : "Module"}`
                  : `Add ${isSubModule ? "Sub Module" : "Module"}`}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={
              isSubModule ? saveSubModule : saveModule
            }
            className="space-y-4"
          >
            {renderFormFields()}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
              >
                {isView ? "Close" : "Cancel"}
              </Button>

              {!isView && (
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-green-700 text-white hover:bg-green-800"
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
