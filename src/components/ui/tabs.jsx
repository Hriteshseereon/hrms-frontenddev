import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { usePathname } from "@/lib/router";

import { cn } from "@/lib/utils";
import { useTabEnabled } from "@/lib/feature-gate";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "bg-muted text-muted-foreground no-scrollbar inline-flex h-9 max-w-full items-center justify-start overflow-x-auto overflow-y-hidden rounded-lg p-1",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

// A tab the organisation has switched off (Configuration → Modules & features) is not rendered at all.
const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => {
  const enabled = useTabEnabled(usePathname(), props.value);
  if (!enabled) return null;
  return <TabsTriggerBase ref={ref} className={className} {...props} />;
});

const TabsTriggerBase = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "ring-offset-background focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=active]:shadow",
      className,
    )}
    {...props}
  />
));
TabsTriggerBase.displayName = "TabsTriggerBase";
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef(({ className, ...props }, ref) => {
  const enabled = useTabEnabled(usePathname(), props.value);
  if (!enabled) return null;
  return <TabsContentBase ref={ref} className={className} {...props} />;
});

const TabsContentBase = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "ring-offset-background focus-visible:ring-ring mt-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
      className,
    )}
    {...props}
  />
));
TabsContentBase.displayName = "TabsContentBase";
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
