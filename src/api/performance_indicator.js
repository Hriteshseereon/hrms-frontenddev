import SuperAdmin_axios from "./SuperAdmin_axios";

const BASE = "/performance-indicators";
const CATEGORY_BASE = "/performance/indicator-categories";
const GOAL_BASE = "/performance/goal-types";
const CYCLE_BASE = "/performance/review-cycles";

// Scope IDs (organization_id, company_id, branch_id) go in `params` (query string), never in the body.
const SuperAdmin_performanceIndicator = {
  getAll: (params) => SuperAdmin_axios.get(BASE, { params }),
  getById: (id, params) => SuperAdmin_axios.get(`${BASE}/${id}`, { params }),
  create: (payload, params) => SuperAdmin_axios.post(BASE, payload, { params }),
  update: (id, payload, params) => SuperAdmin_axios.put(`${BASE}/${id}`, payload, { params }),
  remove: (id, params) => SuperAdmin_axios.delete(`${BASE}/${id}`, { params }),

  // Dropdown helpers
  getCategories: (params) => SuperAdmin_axios.get(`${BASE}/categories`, { params }),
  getMeasurementUnits: (params) => SuperAdmin_axios.get(`${BASE}/measurement-units`, { params }),

  // Indicator Categories master
  getIndicatorCategories: (params) => SuperAdmin_axios.get(CATEGORY_BASE, { params }),
  getIndicatorCategoryById: (id, params) =>
    SuperAdmin_axios.get(`${CATEGORY_BASE}/${id}`, { params }),
  createIndicatorCategory: (payload, params) =>
    SuperAdmin_axios.post(CATEGORY_BASE, payload, { params }),
  updateIndicatorCategory: (id, payload, params) =>
    SuperAdmin_axios.put(`${CATEGORY_BASE}/${id}`, payload, { params }),
  removeIndicatorCategory: (id, params) =>
    SuperAdmin_axios.delete(`${CATEGORY_BASE}/${id}`, { params }),

  // Goal Types master
  getGoalTypes: (params) => SuperAdmin_axios.get(GOAL_BASE, { params }),
  getGoalTypeById: (id, params) => SuperAdmin_axios.get(`${GOAL_BASE}/${id}`, { params }),
  createGoalType: (payload, params) => SuperAdmin_axios.post(GOAL_BASE, payload, { params }),
  updateGoalType: (id, payload, params) =>
    SuperAdmin_axios.put(`${GOAL_BASE}/${id}`, payload, { params }),
  patchGoalType: (id, payload, params) =>
    SuperAdmin_axios.patch(`${GOAL_BASE}/${id}`, payload, { params }),
  removeGoalType: (id, params) => SuperAdmin_axios.delete(`${GOAL_BASE}/${id}`, { params }),

  // Review Cycles master
  getReviewCycles: (params) => SuperAdmin_axios.get(CYCLE_BASE, { params }),
  getReviewCycleById: (id, params) => SuperAdmin_axios.get(`${CYCLE_BASE}/${id}`, { params }),
  createReviewCycle: (payload, params) => SuperAdmin_axios.post(CYCLE_BASE, payload, { params }),
  updateReviewCycle: (id, payload, params) =>
    SuperAdmin_axios.put(`${CYCLE_BASE}/${id}`, payload, { params }),
  patchReviewCycle: (id, payload, params) =>
    SuperAdmin_axios.patch(`${CYCLE_BASE}/${id}`, payload, { params }),
  removeReviewCycle: (id, params) => SuperAdmin_axios.delete(`${CYCLE_BASE}/${id}`, { params }),
};

export default SuperAdmin_performanceIndicator;