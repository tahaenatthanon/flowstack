interface ProgressBarProps {
  percentage: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const ProgressBar = ({ percentage, size = 'md', showLabel = true }: ProgressBarProps) => {
  const height = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-4' : 'h-2.5';
  const fillColor =
    percentage >= 100 ? 'progress-fill' :
    percentage >= 70 ? 'progress-fill' :
    percentage >= 40 ? 'progress-fill-warning' :
    'progress-fill-danger';

  return (
    <div className="flex items-center gap-3">
      <div className={`flex-1 rounded-full overflow-hidden ${height}`} style={{ background: 'hsl(var(--progress-bg))' }}>
        <div
          className={`${height} rounded-full transition-all duration-700 ease-out ${fillColor}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-semibold font-heading min-w-[3rem] text-right">
          {percentage}%
        </span>
      )}
    </div>
  );
};

export default ProgressBar;
