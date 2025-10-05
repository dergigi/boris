import { useState, useCallback } from 'react'

interface ToastState {
  message: string | null
  type: 'success' | 'error'
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({ message: null, type: 'success' })

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }, [])

  const clearToast = useCallback(() => {
    setToast({ message: null, type: 'success' })
  }, [])

  return {
    toastMessage: toast.message,
    toastType: toast.type,
    showToast,
    clearToast
  }
}
