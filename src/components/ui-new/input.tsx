import { type InputHTMLAttributes, forwardRef } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", type = "text", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={`h-10 w-full rounded-lg border border-line-2 bg-bg-2 px-3 text-[14px] text-fg placeholder:text-fg-4 outline-none transition-colors focus:border-line-3 focus:bg-bg-3 ${className}`}
      {...rest}
    />
  );
});
