'use client'

interface ConfirmModalProps {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-zinc-900 rounded-2xl p-6 max-w-md mx-4 shadow-2xl border-2 border-amber-400/50"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-3">{title}</h2>
        <p className="text-white/80 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-5 py-2 bg-zinc-700 hover:bg-zinc-600 active:scale-95 text-white font-bold rounded-lg transition"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold rounded-lg transition"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
