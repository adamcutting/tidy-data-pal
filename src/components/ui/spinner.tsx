
import React from 'react';
import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Spinner: React.FC<SpinnerProps> = ({ className, size = 'sm' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
    xl: 'h-16 w-16',
    '2xl': 'h-24 w-24'
  };

  return (
    <div 
      className={cn(
        "inline-block animate-spin rounded-full border-3 border-solid border-current border-r-transparent align-[-0.125em] text-current motion-reduce:animate-[spin_1.5s_linear_infinite]",
        sizeClasses[size],
        className
      )} 
      role="status"
    >
      <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
        Loading...
      </span>
    </div>
  );
};
