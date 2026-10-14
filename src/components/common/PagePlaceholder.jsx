import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function PagePlaceholder({ icon: Icon, title, description, action }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        </div>
        <Button className="bg-gradient-emerald shadow-premium text-white">{action}</Button>
      </div>
      <Card className="shadow-card border-dashed">
        <CardContent className="p-16 text-center">
          <div className="bg-gradient-emerald shadow-premium mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl text-white">
            <Icon className="h-9 w-9" />
          </div>
          <h2 className="text-xl font-semibold">Coming to life</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            This module is part of the Seereon HRMS super admin experience. The final UI includes
            rich data tables, filters, drawers and audit-ready workflows.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="outline">Learn more</Button>
            <Button className="bg-gradient-emerald text-white">{action}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
