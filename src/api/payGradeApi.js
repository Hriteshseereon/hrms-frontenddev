
import SuperAdmin_axios from "@/api/SuperAdmin_axios";

export const getPayGradeOptions = () =>
  SuperAdmin_axios.get("/pay-grades/options");

export const getPayGrades = (params = {}) =>
  SuperAdmin_axios.get("/pay-grades", { params });

export const getPayGradeById = (payGradeId) =>
  SuperAdmin_axios.get(`/pay-grades/${encodeURIComponent(payGradeId)}`);

export const createPayGrade = (payload) =>
  SuperAdmin_axios.post("/pay-grades", payload);

export const updatePayGrade = (payGradeId, payload) =>
  SuperAdmin_axios.put(
    `/pay-grades/${encodeURIComponent(payGradeId)}`,
    payload,
  );

export const patchPayGrade = (payGradeId, payload) =>
  SuperAdmin_axios.patch(
    `/pay-grades/${encodeURIComponent(payGradeId)}`,
    payload,
  );

export const deletePayGrade = (payGradeId) =>
  SuperAdmin_axios.delete(`/pay-grades/${encodeURIComponent(payGradeId)}`);
