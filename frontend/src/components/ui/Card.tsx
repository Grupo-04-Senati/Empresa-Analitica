interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

const paddings = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export const Card = ({ children, className = '', padding = 'md' }: CardProps) => {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${paddings[padding]} ${className}`}>
      {children}
    </div>
  );
};

interface CardHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const CardHeader = ({ icon, title, subtitle, action }: CardHeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <h3 className="font-semibold text-slate-700">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
};
