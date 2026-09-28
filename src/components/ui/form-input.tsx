import { forwardRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  labelClassName?: string;
  icon?: React.ReactNode;
  showLabel?: boolean;
  suffix?: React.ReactNode;
  iconClassName?: string;
  suffixClassName?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      label,
      id,
      error,
      helperText,
      containerClassName,
      labelClassName,
      icon,
      showLabel = true,
      suffix,
      iconClassName,
      suffixClassName,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn("space-y-2", containerClassName)}>
        {showLabel && (
          <Label
            htmlFor={id}
            className={cn(error && "text-destructive", labelClassName)}
          >
            {icon && <span className="inline-flex items-center mr-2">{icon}</span>}
            {label}
          </Label>
        )}

        <div className="relative">
          {icon && !showLabel && (
            <div className={cn("absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", iconClassName)}>
              {icon}
            </div>
          )}
          <Input
            ref={ref}
            id={id}
            name={id}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
            className={cn(
              icon && !showLabel && "pl-10",
              suffix && "pr-10",
              error && "border-destructive focus-visible:border-destructive",
              className
            )}
            {...props}
          />
          {suffix && (
            <div className={cn("absolute inset-y-0 right-0 flex items-center pr-3", suffixClassName)}>
              {suffix}
            </div>
          )}
        </div>

        {error && (
          <p id={`${id}-error`} className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={`${id}-helper`} className="text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

FormInput.displayName = "FormInput";
