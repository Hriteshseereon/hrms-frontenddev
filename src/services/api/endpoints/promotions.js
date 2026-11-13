import { api } from "../client";

const base = "/cases/promotions";

export const listPromotions = (options) => api.get(base, options);
export const myPromotions = async (options) => {
  const movements = await api.get("/emp/movements", options);
  return movements?.promotions ?? [];
};
export const createPromotion = (body, options) => api.post(base, body, options);
export const promotionDecision = (id, body, options) =>
  api.put(`${base}/${encodeURIComponent(id)}/decision`, body, options);
export const acknowledgeMyPromotion = (id, options) => api.post(`/emp/promotions/${encodeURIComponent(id)}/acknowledge`, {}, options);
export const queryMyPromotion = (id, body, options) => api.post(`/emp/promotions/${encodeURIComponent(id)}/queries`, body, options);
export const replyPromotionQuery = (id, body, options) => api.post(`${base}/${encodeURIComponent(id)}/queries/reply`, body, options);
export const uploadQueryAttachments = (id, files, reply = false) => {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  return api.post(`${base}/${encodeURIComponent(id)}/${reply ? "query-reply-attachments" : "query-attachments"}`, form);
};
export const uploadPromotionIssueAttachments = (employeeId, files) => {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  return api.post(`${base}/issue-attachments`, form, { query: { employee_id: employeeId } });
};
export const openQueryAttachment = async (id, attachment) => {
  const blob = await api.get(`${base}/${encodeURIComponent(id)}/query-attachments/${encodeURIComponent(attachment.name)}`, { query: { url: attachment.url }, responseType: "blob" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = attachment.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
};
export const revisePromotion = (id, body, options) => api.put(`${base}/${encodeURIComponent(id)}/revision`, body, options);
export const cancelPromotion = (id, body, options) => api.post(`${base}/${encodeURIComponent(id)}/cancel`, body, options);
export const resendPromotionLetter = (id, options) => api.post(`${base}/${encodeURIComponent(id)}/letter/resend`, {}, options);
