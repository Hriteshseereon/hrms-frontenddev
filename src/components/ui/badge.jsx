import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors [&>svg]:size-3 [&>svg]:shrink-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/**
 * @typedef {React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & Object} BadgeProps
 */

// Plain-text labels truncate with an ellipsis instead of overflowing when the container is narrower
// than the badge (the badge itself never grows past its container: max-w-full). Consecutive text
// children are kept together in one span so `{a} · {b}` still reads as one label.
const isText = (c) => typeof c === "string" || typeof c === "number";
function groupText(children) {
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length)
      out.push(
        <span key={`t${out.length}`} className="min-w-0 truncate">
          {run.join("")}
        </span>,
      );
    run = [];
  };
  React.Children.toArray(children).forEach((c) => {
    if (isText(c)) run.push(String(c));
    else {
      flush();
      out.push(c);
    }
  });
  flush();
  return out;
}

function Badge({ className, variant, children, ...props }) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props}>
      {groupText(children)}
    </span>
  );
}

export { Badge, badgeVariants };
