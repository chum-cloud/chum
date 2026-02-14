interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  preview?: React.ReactNode;
  destructive?: boolean;
}

export default function ConfirmModal({
  open, title, message, warning, confirmLabel = 'CONFIRM', cancelLabel = 'CANCEL',
  onConfirm, onCancel, preview, destructive = false,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onCancel}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Modal */}
      <div
        className="relative bg-chum-bg border border-chum-border w-full max-w-[360px] p-0 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Preview */}
        {preview && (
          <div className="w-full aspect-square max-h-[200px] overflow-hidden border-b border-chum-border">
            {preview}
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-3">
          <h3 className="font-mono text-sm text-chum-text uppercase tracking-wider">{title}</h3>
          <p className="font-mono text-xs text-chum-muted">{message}</p>
          {warning && (
            <p className="font-mono text-[10px] text-chum-danger border border-chum-danger/30 px-2 py-1">
              {warning}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex border-t border-chum-border">
          <button
            onClick={onCancel}
            className="flex-1 min-h-[44px] font-mono text-xs text-chum-muted uppercase tracking-wider hover:text-chum-text hover:bg-chum-surface transition-colors border-r border-chum-border"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 min-h-[44px] font-mono text-xs uppercase tracking-wider transition-colors ${
              destructive
                ? 'text-chum-danger hover:bg-chum-danger hover:text-chum-bg'
                : 'text-chum-text hover:bg-chum-text hover:text-chum-bg'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
