import { useState, useCallback, useEffect, useRef } from 'react';

type PollingStatus = 'idle' | 'polling' | 'completed' | 'error';

interface PollingResult {
  status: PollingStatus;
  resultUrl: string | null;
  error: string | null;
  startPolling: (ticketId: string, onCompleted?: (resultUrl: string) => void) => void;
  stopPolling: () => void;
}

const N8N_POLLING_URL = '/api/generate/status';
const MAX_POLLING_ATTEMPTS = 60;

export const usePolling = (intervalMs = 3000): PollingResult => {
  const [status, setStatus] = useState<PollingStatus>('idle');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const attemptsRef = useRef(0);
  const checkingRef = useRef(false);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = null;
  }, []);

  const stopPolling = useCallback(() => {
    clearPolling();
    setStatus(current => current === 'polling' ? 'idle' : current);
  }, [clearPolling]);

  const startPolling = useCallback((ticketId: string, onCompleted?: (resultUrl: string) => void) => {
    clearPolling();
    setStatus('polling');
    setResultUrl(null);
    setError(null);
    attemptsRef.current = 0;

    const checkStatus = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      attemptsRef.current += 1;
      if (attemptsRef.current > MAX_POLLING_ATTEMPTS) {
        setError('La generación tardó demasiado. Revisa n8n y vuelve a intentarlo.');
        setStatus('error');
        clearPolling();
        checkingRef.current = false;
        return;
      }

      try {
        const response = await fetch(`${N8N_POLLING_URL}?ticket_id=${encodeURIComponent(ticketId)}`);
        if (!response.ok) {
          throw new Error('Error de red al consultar el estado');
        }
        
        const data = await response.json();
        
        // Asumiendo que el webhook devuelve { status: 'completed' | 'processing' | 'error', finalUrl?: '...' }
        const resultUrl = data.finalUrl || data.final_url || data.imageUrl || data.image_url;
        if (data.status === 'completed' && resultUrl) {
          setResultUrl(resultUrl);
          setStatus('completed');
          onCompleted?.(resultUrl);
          clearPolling();
        } else if (data.status === 'error' && data.error !== 'Ticket no encontrado.') {
          setError(data.error || data.message || 'Ocurrió un error al generar la imagen');
          setStatus('error');
          clearPolling();
        }
        // Si status === 'processing', dejamos que el polling continúe
      } catch (err) {
        console.error('Error durante el polling:', err);
        // Podríamos decidir fallar tras X errores consecutivos, 
        // pero por ahora solo registramos y dejamos que intente de nuevo en el próximo tick.
      } finally {
        checkingRef.current = false;
      }
    };

    // Hacer la primera comprobación inmediatamente
    checkStatus();

    // Iniciar el intervalo
    pollingRef.current = setInterval(checkStatus, intervalMs);

  }, [clearPolling, intervalMs]);

  useEffect(() => () => {
    clearPolling();
  }, [clearPolling]);

  return { status, resultUrl, error, startPolling, stopPolling };
};
