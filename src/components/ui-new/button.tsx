import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "ghost" | "link" | "icon";
type Size = "md" | "sm";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "btn btn-primary",
  ghost: "btn btn-ghost",
  link: "btn btn-link",
  icon: "btn btn-ghost btn-icon",
};

const SIZE_CLASS: Record<Size, string> = {
  md: "",
  sm: "btn-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className = "",
      variant = "primary",
      size = "md",
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={`${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
        {...rest}
      />
    );
  },
);
