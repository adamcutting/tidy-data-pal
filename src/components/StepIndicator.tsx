
import React from 'react';
import { FileText, Columns, Settings, Activity, CheckCircle, AlertTriangle, Timer } from 'lucide-react';
import { Step } from '@/lib/types';

interface StepIndicatorProps {
  currentStep: Step;
  setStep: (step: Step) => void;
  completedSteps: Set<Step>;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ 
  currentStep, 
  setStep, 
  completedSteps 
}) => {
  const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
    { id: 'upload', label: 'Upload Data', icon: <FileText className="h-5 w-5" /> },
    { id: 'mapping', label: 'Map Columns', icon: <Columns className="h-5 w-5" /> },
    { id: 'config', label: 'Configure', icon: <Settings className="h-5 w-5" /> },
    { id: 'progress', label: 'Process', icon: <Activity className="h-5 w-5" /> },
    { id: 'results', label: 'Results', icon: <CheckCircle className="h-5 w-5" /> },
    { id: 'jobs', label: 'Running Jobs', icon: <Timer className="h-5 w-5" /> },
  ];

  const handleStepClick = (step: Step) => {
    // Only allow navigation to completed steps or the jobs step
    if (completedSteps.has(step) || step === 'jobs') {
      setStep(step);
    }
  };

  return (
    <nav className="flex flex-wrap justify-center gap-2">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(step.id);
        const isCurrent = currentStep === step.id;
        
        return (
          <button
            key={step.id}
            onClick={() => handleStepClick(step.id)}
            className={`
              relative flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg
              transition-all duration-200 
              ${isCompleted || step.id === 'jobs' ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}
              ${isCurrent ? 'bg-primary text-primary-foreground font-medium shadow-md' : 
                isCompleted || step.id === 'jobs' ? 'bg-secondary hover:bg-secondary/80' : 'bg-muted'}
            `}
            disabled={!isCompleted && step.id !== 'jobs'}
          >
            {step.icon}
            <span className="hidden sm:inline">{step.label}</span>
            
            {index < steps.length - 1 && (
              <div className="hidden sm:block absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 z-10">
                <div className="h-px w-4 bg-muted-foreground/30"></div>
              </div>
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default StepIndicator;
