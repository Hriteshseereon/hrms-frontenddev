import { Layers } from "lucide-react";
import departmentGradeApi from "@/api/departmentGradeApi";
import { SimpleMasterPage } from "@/features/organization/components/SimpleMasterPage";

const config = {
  api: departmentGradeApi,
  fieldKey: "grade_code",
  icon: Layers,
  title: "Department Grade Management",
  subtitle: "Create and manage grades (GRD01, GRD02, …) across your organization.",
  singular: "Grade",
  plural: "Grades",
  fieldLabel: "Grade Code",
  placeholder: "e.g. GRD01",
  maxLength: 30,
  normalize: (v) => v.toUpperCase(),
};

export default function Grade() {
  return <SimpleMasterPage config={config} />;
}
