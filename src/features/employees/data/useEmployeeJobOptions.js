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
        safe(() => departmentApi.getDepartments()),
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

  // Same call the Designation master screen makes (no query params — a page_size above the backend cap made the
  // list come back empty); the department filter is applied here.
  const [allDesignations, setAllDesignations] = useState([]);
  useEffect(() => {
    let alive = true;
    designationApi
      .getDesignations()
      .then((res) => {
        if (!alive) return;
        setAllDesignations(
          listOf(res, ["items", "results", "designations", "data"]).map((d) => ({
            id: d.id,
            name: d.designation_name ?? d.name ?? "",
            departmentId: d.department_id ?? "",
          })),
        );
      })
      .catch((err) => console.warn("Designation load failed:", err));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    setDesignations(
      deptId ? allDesignations.filter((d) => String(d.departmentId) === String(deptId)) : [],
    );
  }, [deptId, allDesignations]);

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
