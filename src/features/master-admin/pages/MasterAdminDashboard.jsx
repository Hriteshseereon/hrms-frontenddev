
import { useEffect, useState } from "react";
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

const MODULE_KEY = "masterAdminModules";
const SUBMODULE_KEY = "masterAdminSubModules";

const initialModules = [
  {
    id: 1,
    name: "HR Management",
    icon: "",
    iconType: "url",
    pathName: "/hr-management",
    description: "Manage human resource activities.",
  },
  {
    id: 2,
    name: "Payroll",
    icon: "",
    iconType: "url",
    pathName: "/payroll",
    description: "Manage salary and payroll activities.",
  },
];

const emptyModule = {
  name: "",
  icon: "",
  iconType: "url",
  pathName: "",
  description: "",
};

const emptySubModule = {
  moduleId: "",
  name: "",
  icon: "",
  iconType: "url",
  pathName: "",
  description: "",
};

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function IconPreview({ item }) {
  if (!item?.icon) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-green-50 text-green-700">
        <ImageIcon size={19} />
      </div>
    );
  }

  if (item.iconType === "file") {
    return (
      <img
        src={item.icon}
        alt={item.name || "Icon"}
        className="h-10 w-10 rounded-md border object-contain p-1"
      />
    );
  }

  if (
    item.icon.startsWith("http://") ||
    item.icon.startsWith("https://") ||
    item.icon.startsWith("data:image/")
  ) {
    return (
      <img
        src={item.icon}
        alt={item.name || "Icon"}
        className="h-10 w-10 rounded-md border object-contain p-1"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-green-50 text-green-700">
      <span className="max-w-full truncate text-xs font-semibold">
        {item.icon}
      </span>
    </div>
  );
}

export default function MasterAdminDashboard() {
  const navigate = useNavigate();

  const [activePage, setActivePage] = useState("Dashboard");

  const [modules, setModules] = useState(() =>
    readStorage(MODULE_KEY, initialModules)
  );

  const [subModules, setSubModules] = useState(() =>
    readStorage(SUBMODULE_KEY, [])
  );

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyModule);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    localStorage.setItem(MODULE_KEY, JSON.stringify(modules));
  }, [modules]);

  useEffect(() => {
    localStorage.setItem(SUBMODULE_KEY, JSON.stringify(subModules));
  }, [subModules]);

  useEffect(() => {
    if (sessionStorage.getItem("masterAdminLoggedIn") !== "true") {
      navigate("/master-admin/login", { replace: true });
    }
  }, [navigate]);

  const isView =
    modal === "viewModule" || modal === "viewSubModule";

  const isSubModule =
    modal === "submodule" || modal === "viewSubModule";

  const closeModal = () => {
    setModal(null);
    setEditingId(null);
  };

  const resetForm = (value) => {
    setForm(value);
    setEditingId(null);
  };

  // MODULE ACTIONS

  const openAddModule = () => {
    resetForm(emptyModule);
    setModal("module");
  };

  const openEditModule = (item) => {
    setForm({
      ...emptyModule,
      ...item,
      icon: item.icon || "",
      iconType: item.iconType || "url",
      pathName: item.pathName || "",
    });

    setEditingId(item.id);
    setModal("module");
  };

  const saveModule = (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const pathName = form.pathName.trim();

    if (!name || !pathName) return;

    const record = {
      ...form,
      name,
      pathName,
      description: form.description.trim(),
    };

    if (editingId !== null) {
      setModules((current) =>
        current.map((item) =>
          item.id === editingId ? { ...item, ...record } : item
        )
      );
    } else {
      setModules((current) => [
        ...current,
        { ...record, id: Date.now() },
      ]);
    }

    closeModal();
    setForm(emptyModule);
  };

  const deleteModule = (item) => {
    const hasSubModules = subModules.some(
      (sub) => String(sub.moduleId) === String(item.id)
    );

    const message = hasSubModules
      ? `Delete "${item.name}" and all its submodules?`
      : `Delete module "${item.name}"?`;

    if (!window.confirm(message)) return;

    setModules((current) =>
      current.filter((module) => module.id !== item.id)
    );

    setSubModules((current) =>
      current.filter(
        (sub) => String(sub.moduleId) !== String(item.id)
      )
    );
  };

  // SUBMODULE ACTIONS

  const openAddSubModule = () => {
    resetForm(emptySubModule);
    setModal("submodule");
  };

  const openEditSubModule = (item) => {
    setForm({
      ...emptySubModule,
      ...item,
      moduleId: String(item.moduleId),
      icon: item.icon || "",
      iconType: item.iconType || "url",
      pathName: item.pathName || "",
    });

    setEditingId(item.id);
    setModal("submodule");
  };

  const saveSubModule = (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const pathName = form.pathName.trim();

    if (!form.moduleId || !name || !pathName) return;

    const record = {
      ...form,
      name,
      pathName,
      moduleId: Number(form.moduleId),
      description: form.description.trim(),
    };

    if (editingId !== null) {
      setSubModules((current) =>
        current.map((item) =>
          item.id === editingId ? { ...item, ...record } : item
        )
      );
    } else {
      setSubModules((current) => [
        ...current,
        { ...record, id: Date.now() },
      ]);
    }

    closeModal();
    setForm(emptySubModule);
  };

  const deleteSubModule = (item) => {
    if (!window.confirm(`Delete submodule "${item.name}"?`)) return;

    setSubModules((current) =>
      current.filter((sub) => sub.id !== item.id)
    );
  };

  const getModuleName = (moduleId) =>
    modules.find((item) => item.id === Number(moduleId))?.name ||
    "Unknown module";

  const logout = () => {
    sessionStorage.removeItem("masterAdminLoggedIn");
    navigate("/master-admin/login", { replace: true });
  };

  const visibleModules = modules.filter((item) =>
    `${item.name} ${item.pathName} ${item.description}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const visibleSubModules = subModules.filter((item) =>
    `${item.name} ${item.pathName} ${item.description} ${getModuleName(
      item.moduleId
    )}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Module", icon: Package },
    { name: "Sub Module", icon: Layers },
  ];

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleIconUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      window.alert("Please select an image file.");
      event.target.value = "";
      return;
    }

    // Keep the preview and form simple for this frontend prototype.
    // Real file storage should be implemented by the backend.
    const reader = new FileReader();

    reader.onload = () => {
      updateField("icon", String(reader.result || ""));
      updateField("iconType", "file");
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
          onChange={(event) => updateField("name", event.target.value)}
          placeholder="Enter name"
        />
      </div>

      <div className="space-y-2">
        <Label>Icon</Label>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={form.iconType === "file" ? "default" : "outline"}
            className={
              form.iconType === "file"
                ? "bg-green-700 text-white hover:bg-green-800"
                : ""
            }
            disabled={isView}
            onClick={() => updateField("iconType", "file")}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload File
          </Button>

          <Button
            type="button"
            variant={form.iconType !== "file" ? "default" : "outline"}
            className={
              form.iconType !== "file"
                ? "bg-green-700 text-white hover:bg-green-800"
                : ""
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
            value={form.icon || ""}
            onChange={(event) => updateField("icon", event.target.value)}
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
        <Label htmlFor="pathName">Path Name *</Label>
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
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className="flex w-60 shrink-0 flex-col border-r bg-white">
          <div className="border-b px-5 py-6">
            <h1 className="text-xl font-bold text-green-700">
              SEEREON
            </h1>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {navItems.map(({ name, icon: Icon }) => (
              <button
                key={name}
                onClick={() => {
                  setActivePage(name);
                  setSearch("");
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors ${
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

        {/* MAIN CONTENT */}
        <main className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b bg-white px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold">{activePage}</h2>
              <p className="text-xs text-slate-500">
                Master Admin / {activePage}
              </p>
            </div>

            <span className="rounded-full bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
              Master Admin
            </span>
          </header>

          <section className="p-6">
            {/* DASHBOARD */}
            {activePage === "Dashboard" && (
              <>
                <h2 className="text-2xl font-bold">Dashboard</h2>
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

            {/* MODULE PAGE */}
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
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search modules..."
                  className="mb-4 max-w-sm bg-white"
                />

                <div className="overflow-x-auto rounded-xl border bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-green-50 text-green-900">
                      <tr>
                        <th className="p-4">Name</th>
                        <th className="p-4">Icon</th>
                        <th className="p-4">Path Name</th>
                        <th className="p-4">Description</th>
                        <th className="p-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleModules.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-4 font-medium">{item.name}</td>
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
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="View"
                                onClick={() => {
                                  setForm({
                                    ...emptyModule,
                                    ...item,
                                  });
                                  setModal("viewModule");
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Edit"
                                onClick={() => openEditModule(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                onClick={() => deleteModule(item)}
                                className="text-red-700 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {visibleModules.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500">
                            No modules found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* SUBMODULE PAGE */}
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

                {/* Parent module selection is only inside the form */}
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search submodules..."
                  className="mb-4 max-w-sm bg-white"
                />

                <div className="overflow-x-auto rounded-xl border bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-green-50 text-green-900">
                      <tr>
                        <th className="p-4">Name</th>
                        <th className="p-4">Icon</th>
                        <th className="p-4">Path Name</th>
                        <th className="p-4">Description</th>
                        <th className="p-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSubModules.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-4">
                            <p className="font-medium">{item.name}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Parent: {getModuleName(item.moduleId)}
                            </p>
                          </td>
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
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="View"
                                onClick={() => {
                                  setForm({
                                    ...emptySubModule,
                                    ...item,
                                    moduleId: String(item.moduleId),
                                  });
                                  setModal("viewSubModule");
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Edit"
                                onClick={() => openEditSubModule(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                onClick={() => deleteSubModule(item)}
                                className="text-red-700 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {visibleSubModules.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500">
                            No submodules found. Click Add Sub Module to create one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </main>
      </div>

      {/* ADD / EDIT / VIEW DIALOG */}
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
            onSubmit={isSubModule ? saveSubModule : saveModule}
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
                  className="bg-green-700 text-white hover:bg-green-800"
                >
                  Save
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
