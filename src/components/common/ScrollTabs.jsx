import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** Single-line, horizontally scrollable tab bar. */
export function ScrollTabsList({ className, children }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <TabsList
        className={cn(
          "inline-flex w-max flex-nowrap justify-start gap-1",
          "[&>*]:shrink-0 [&>*]:gap-2 [&>*]:whitespace-nowrap",
          className,
        )}
      >
        {children}
      </TabsList>
    </div>
  );
}
