import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  text?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner = ({ size = 32, text = 'Cargando...', fullScreen = false }: LoadingSpinnerProps) => {
  const content = (
    <div className="flex flex-col items-center gap-3">
      <Loader2 size={size} className="animate-spin text-blue-600" />
      {text && <p className="text-slate-500 text-sm">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return <div className="py-16 flex items-center justify-center">{content}</div>;
};
