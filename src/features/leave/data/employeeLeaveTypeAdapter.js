import employeeLeaveTypeApi from "@/api/employeeLeaveTypeApi";

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

// Convert backend leave-type data into a consistent frontend format.
const toEmployeeLeaveType = (item) => ({
  id: String(item.id ?? item.code ?? item.name ?? ""),
  name: item.name ?? item.leave_type_name ?? "",
  code: item.code ?? "",
  annual: toNumber(item.annual_days),
  creditFrequency: item.credit ?? "",
  maxConsecutive: toNumber(item.max_consecutive),
  validityDays: toNumber(item.validity_days),
  maxCarry: toNumber(item.max_carry_forward),
  encashOn: item.encash_on ?? "",
  applicableTo: item.applicable_to ?? "All",
  paid: Boolean(item.paid_leave),
  encashable: Boolean(item.encashable_at_year_end),
  clubbable: Boolean(item.clubbable),
  active: item.active !== false && item.is_active !== false,
});

// Support different response formats returned by the backend.
const unwrapLeaveTypes = (response) => {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.leave_types)) {
    return response.leave_types;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.leave_types)) {
    return response.data.leave_types;
  }

  if (Array.isArray(response?.data?.items)) {
    return response.data.items;
  }

  return [];
};

// Fetch active leave types created in Super Admin.
export async function getEmployeeLeaveTypes(params = {}) {
  const response = await employeeLeaveTypeApi.getAll(params);

  return unwrapLeaveTypes(response)
    .filter(
      (item) =>
        item &&
        item.active !== false &&
        item.is_active !== false,
    )
    .map(toEmployeeLeaveType)
    .filter((item) => item.name.trim() !== "");
}

export default getEmployeeLeaveTypes;