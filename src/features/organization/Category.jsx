import { Tags } from "lucide-react";
import departmentCategoryApi from "@/api/departmentCategoryApi";
import { SimpleMasterPage } from "@/features/organization/components/SimpleMasterPage";

const config = {
  api: departmentCategoryApi,
  fieldKey: "category_name",
  icon: Tags,
  title: "Category Management",
  subtitle: "Create and manage category types (Managerial, Skilled, Semi-skilled, …).",
  singular: "Category",
  plural: "Categories",
  fieldLabel: "Category Type",
  placeholder: "e.g. Managerial",
  maxLength: 100,
};

export default function Category() {
  return <SimpleMasterPage config={config} />;
}
