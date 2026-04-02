import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-primary/20 bg-gradient-accent text-primary-foreground shadow-[0_18px_32px_-24px_hsl(var(--primary)/0.72)] hover:-translate-y-0.5 hover:brightness-[1.03] active:translate-y-0 active:brightness-[0.98]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
        outline:
          "border border-input/80 bg-background/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-primary/20 hover:bg-accent/55 hover:text-foreground active:bg-accent-active",
        secondary:
          "border border-secondary/70 bg-secondary/90 text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-secondary-hover active:bg-secondary-active",
        ghost: "text-foreground/80 hover:bg-muted-hover hover:text-foreground active:bg-accent-active",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
