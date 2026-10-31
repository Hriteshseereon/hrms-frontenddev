import { useEffect, useState } from "react";
import departmentApi from "@/api/departmentApi";
import designationApi from "@/api/designationApi";
import { rbacApi } from "@/api/rbacApi";
import SuperAdmin_shift from "@/api/shift";
import { getEmployees } from "@/api/employeeApi";

export const isUuid = (x) =>
  typeof x === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);

/** Pulls the row array out of any of the backend's list envelopes ([..], {items}, {data}, {data:{items}}). */
export function listOf(res, keys = ["items", "results", "data"]) {
  const data = res?.data ?? res;
  if (Array.isArray(data)) return data;
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
    if (Array.isArray(data?.data?.[k])) return data.data[k];
  }
  return [];
}

export const staffLabel = (e) =>
  `${[e.first_name, e.last_name].filter(Boolean).join(" ") || e.work_email}${
    e.designation ? ` — ${e.designation}` : ""
  }`;

/**
 * Dropdown data for the employee Add / Edit forms, all from the backend masters.
 * `designations` is the list of the chosen department; managers / HR are scoped to `companyId` when given.
 */
export function useEmployeeJobOptions({ deptId, companyId, orgId }) {
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [managers, setManagers] = useState([]);
  const [hrs, setHrs] = useState([]);

  useEffect(() => {
    let alive = true;
    const safe = (fn) =>
      fn().catch((err) => {
        console.warn("Job & Role option load failed:", err);
        return null;
      });
    (async () => {
      const [dRes, rRes, sRes] = await Promise.all([
        safe(() => departmentApi.getDepartments({ page_size: 200 })),
        safe(() => rbacApi.getRoles()),
        safe(() =>
          SuperAdmin_shift.getAll({
            ...(isUuid(orgId) ? { organization_id: orgId } : {}),
            page: 1,
            page_size: 100,
          }),
        ),
      ]);
      if (!alive) return;
      setDepartments(
        listOf(dRes, ["items", "departments", "data"]).map((d) => ({
          id: d.id,
          name: d.department_name ?? d.name ?? "",
        })),
      );
      setRoles(
        (Array.isArray(rRes) ? rRes : listOf(rRes, ["data", "items", "roles"]))
          .map((r) => ({ id: r.id, name: r.role_name ?? r.name ?? "", status: r.status }))
          .filter((r) => r.name && (!r.status || String(r.status).toLowerCase() === "active")),
      );
      setShifts(
        listOf(sRes).map((x) => ({
          id: x.id,
          name: x.shift_name ?? x.name ?? "",
          start: String(x.start_time ?? "").slice(0, 5),
          end: String(x.end_time ?? "").slice(0, 5),
        })),
      );
    })();
    return () => {
      alive = false;
    };
  }, [orgId]);

  useEffect(() => {
    let alive = true;
    setDesignations([]);
    if (!deptId) return undefined;
    designationApi
      .getDesignations({ department_id: deptId, page_size: 200 })
      .then((res) => {
        if (!alive) return;
        setDesignations(
          listOf(res, ["items", "designations", "data"]).map((d) => ({
            id: d.id,
            name: d.designation_name ?? d.name ?? "",
          })),
        );
      })
      .catch((err) => console.warn("Designation load failed:", err));
    return () => {
      alive = false;
    };
  }, [deptId]);

  useEffect(() => {
    let alive = true;
    const scope = { page: 1, limit: 100, company_id: isUuid(companyId) ? companyId : "" };
    Promise.all([
      getEmployees({ ...scope, designation_type: "manager" }),
      getEmployees({ ...scope, designation_type: "hr" }),
    ])
      .then(([m, h]) => {
        if (!alive) return;
        setManagers(listOf(m, ["items", "employees", "data"]));
        setHrs(listOf(h, ["items", "employees", "data"]));
      })
      .catch((err) => console.warn("Manager/HR list load failed:", err));
    return () => {
      alive = false;
    };
  }, [companyId]);

  return { departments, designations, roles, shifts, managers, hrs };
}
