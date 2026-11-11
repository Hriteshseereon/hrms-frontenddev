import SuperAdmin_axios from "./SuperAdmin_axios";

const BASE = "/resignations";

// Employee portal - Apply for Resignation.
// API files only call endpoints; all field mapping lives in
// src/features/exit/data/resignation_adapter.js
const Employee_resignation = {
  // GET /resignations/reasons  (Resignation Reason dropdown)
  getReasons: (params) => SuperAdmin_axios.get(`${BASE}/reasons`, { params }),

  // POST /resignations/apply  (multipart/form-data)
  apply: (formData, params) => SuperAdmin_axios.post(`${BASE}/apply`, formData, { params }),

  // GET /resignations/{resignation_id}  (View Resignation in employee portal)
  getById: (id, params) => SuperAdmin_axios.get(`${BASE}/${id}`, { params }),
};

export default Employee_resignation;
