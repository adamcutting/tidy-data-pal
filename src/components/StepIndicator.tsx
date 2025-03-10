
import React from 'react';
import { cn } from '@/lib/utils';
import { Step } from '@/lib/types';

interface StepIndicatorProps {
  currentStep: Step;
  setStep: (step: Step) => void;
  completedSteps: Set<Step>;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  setStep,
  completedSteps,
}) => {
  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: 'Upload Data' },
    { key: 'mapping', label: 'Map Columns' },
    { key: 'config', label: 'Configure' },
    { key: 'progress', label: 'Processing' },
    { key: 'results', label: 'Results' },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto mb-8">
      <div className="flex justify-between items-center relative">
        {/* Progress bar */}
        <div className="absolute h-0.5 bg-muted inset-x-0 top-1/2 -translate-y-1/2" />
        <div 
          className="absolute h-0.5 bg-primary inset-y-1/2 -translate-y-1/2 transition-all duration-500 ease-in-out"
          style={{ 
            width: `${
              (steps.findIndex(s => s.key === currentStep) / (steps.length - 1)) * 100
            }%` 
          }} 
        />

        {/* Steps */}
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.key);
          const isCurrent = currentStep === step.key;
          const isClickable = isCompleted || 
            [...completedSteps].some(s => steps.findIndex(st => st.key === s) === index - 1);
          
          return (
            <div key={step.key} className="z-10 flex flex-col items-center">
              <button
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 focus-ring",
                  isCompleted || isCurrent 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground",
                  isClickable && !isCurrent
                    ? "hover:scale-110 cursor-pointer"
                    : !isClickable && !isCurrent
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                )}
                onClick={() => isClickable && setStep(step.key)}
                disabled={!isClickable}
              >
                {index + 1}
              </button>
              <span 
                className={cn(
                  "mt-2 text-sm font-medium transition-colors duration-300",
                  isCurrent ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
