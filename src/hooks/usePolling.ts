import { useState, useCallback, useEffect, useRef } from 'react';

type PollingStatus = 'idle' | 'polling' | 'completed' | 'error';

interface PollingResult {
  status: PollingStatus;
  resultUrl: string | null;
  error: string | null;
  startPolling: (ticketId: string) => void;
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
    attemptsRef.current = 0;

    const checkStatus = async () => {
      attemptsRef.current += 1;
      if (attemptsRef.current > MAX_POLLING_ATTEMPTS) {
        setError('La generación tardó demasiado. Revisa n8n y vuelve a intentarlo.');
        setStatus('error');
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
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
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else if (data.status === 'error' && data.error !== 'Ticket no encontrado.') {
          setError(data.error || data.message || 'Ocurrió un error al generar la imagen');
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

  useEffect(() => () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
  }, []);

  return { status, resultUrl, error, startPolling, stopPolling };
};
