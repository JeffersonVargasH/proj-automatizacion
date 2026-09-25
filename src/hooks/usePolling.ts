import { useState, useCallback, useRef } from 'react';

type PollingStatus = 'idle' | 'polling' | 'completed' | 'error';

interface PollingResult {
  status: PollingStatus;
  resultUrl: string | null;
  error: string | null;
  startPolling: (ticketId: string) => void;
  stopPolling: () => void;
}

const N8N_POLLING_URL = process.env.NEXT_PUBLIC_N8N_STATUS_WEBHOOK || 'https://tu-n8n.com/webhook/status';

export const usePolling = (intervalMs = 3000): PollingResult => {
  const [status, setStatus] = useState<PollingStatus>('idle');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (status === 'polling') {
      setStatus('idle');
    }
  }, [status]);

  const startPolling = useCallback((ticketId: string) => {
    setStatus('polling');
    setResultUrl(null);
    setError(null);

    const checkStatus = async () => {
      try {
        const response = await fetch(`${N8N_POLLING_URL}?ticket_id=${ticketId}`);
        if (!response.ok) {
          throw new Error('Error de red al consultar el estado');
        }
        
        const data = await response.json();
        
        // Asumiendo que el webhook devuelve { status: 'completed' | 'processing' | 'error', finalUrl?: '...' }
        if (data.status === 'completed' && data.finalUrl) {
          setResultUrl(data.finalUrl);
          setStatus('completed');
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else if (data.status === 'error') {
          setError(data.message || 'Ocurrió un error al generar la imagen');
          setStatus('error');
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
        // Si status === 'processing', dejamos que el polling continúe
      } catch (err) {
        console.error('Error durante el polling:', err);
        // Podríamos decidir fallar tras X errores consecutivos, 
        // pero por ahora solo registramos y dejamos que intente de nuevo en el próximo tick.
      }
    };

    // Hacer la primera comprobación inmediatamente
    checkStatus();

    // Iniciar el intervalo
    pollingRef.current = setInterval(checkStatus, intervalMs);

  }, [intervalMs]);

  return { status, resultUrl, error, startPolling, stopPolling };
};
