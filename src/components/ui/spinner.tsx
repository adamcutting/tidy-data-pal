
import React from 'react';
import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'secondary' | 'success' | 'destructive' | 'warning';
  label?: string;
  showLabel?: boolean;
}

export const Spinner: React.FC<SpinnerProps> = ({ 
  className, 
  size = 'sm', 
  variant = 'default',
  label = 'Loading...',
  showLabel = false
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
    xl: 'h-16 w-16'
  };
  
  const variantClasses = {
    default: 'text-primary',
    secondary: 'text-secondary',
    success: 'text-green-500',
    destructive: 'text-red-500',
    warning: 'text-amber-500'
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div 
        className={cn(
          "inline-block animate-spin rounded-full border-3 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]",
          sizeClasses[size],
          variantClasses[variant]
        )} 
        role="status"
        aria-label={label}
      >
        <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
          {label}
        </span>
      </div>
      {showLabel && (
        <span className={cn("text-sm font-medium", variantClasses[variant])}>
          {label}
        </span>
      )}
    </div>
  );
};
