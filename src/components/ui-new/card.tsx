import { type HTMLAttributes, forwardRef } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: "none" | "sm" | "md" | "lg";
};

const padMap = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
} as const;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className = "", padding = "md", ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`rounded-card border border-line bg-bg-card ${padMap[padding]} ${className}`}
      {...rest}
    />
  );
});
