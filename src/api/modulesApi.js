import SuperAdmin_axios from "./SuperAdmin_axios";

/** GET /modules/catalog -> [{ key, name, submodules }] — the 16 fixed module keys. */
export const getModuleCatalog = async () => {
  const res = await SuperAdmin_axios.get("/modules/catalog");
  const data = res.data?.data ?? res.data;
  return Array.isArray(data) ? data : (data?.items ?? []);
};
