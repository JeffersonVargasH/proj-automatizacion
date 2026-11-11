import { useState, useCallback, useEffect, useRef } from 'react';

type PollingStatus = 'idle' | 'polling' | 'completed' | 'error';

interface PollingResult {
  status: PollingStatus;
  ticketId: string | null;
  resultUrl: string | null;
  /** Una imagen por red cuando n8n devuelve `finalUrls: { instagram, facebook, whatsapp }`. */
  resultUrls: Record<string, string>;
  error: string | null;
  startPolling: (ticketId: string) => void;
  stopPolling: () => void;
}

const N8N_POLLING_URL = '/api/generate/status';
const MAX_POLLING_ATTEMPTS = 60;

export const usePolling = (intervalMs = 3000): PollingResult => {
  const [status, setStatus] = useState<PollingStatus>('idle');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultUrls, setResultUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const attemptsRef = useRef(0);
  // Evita lanzar una consulta nueva mientras la anterior sigue esperando respuesta.
  const checkingRef = useRef(false);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = null;
  }, []);

  const stopPolling = useCallback(() => {
    clearPolling();
    setStatus(current => current === 'polling' ? 'idle' : current);
  }, [clearPolling]);

  const startPolling = useCallback((ticketId: string) => {
    clearPolling();
    checkingRef.current = false;
    setStatus('polling');
    setTicketId(ticketId);
    setResultUrl(null);
    setResultUrls({});
    setError(null);
    attemptsRef.current = 0;

    const checkStatus = async () => {
      if (checkingRef.current) return;
      attemptsRef.current += 1;
      if (attemptsRef.current > MAX_POLLING_ATTEMPTS) {
        setError('La generación tardó demasiado. Vuelve a intentarlo en unos minutos.');
        setStatus('error');
        clearPolling();
        return;
      }

      checkingRef.current = true;
      try {
        const response = await fetch(`${N8N_POLLING_URL}?ticket_id=${encodeURIComponent(ticketId)}`);
        // Sin sesión o sin acceso a ese trabajo: no tiene sentido seguir preguntando.
        if (response.status === 401 || response.status === 403) {
          const data = await response.json().catch(() => ({}));
          setError(data.error || 'No tienes acceso a esta generación.');
          setStatus('error');
          clearPolling();
          return;
        }
        if (!response.ok) {
          throw new Error('Error de red al consultar el estado');
        }
        
        const data = await response.json();
        
        // Asumiendo que el webhook devuelve { status: 'completed' | 'processing' | 'error', finalUrl?: '...' }
        const urls = data.finalUrls || data.final_urls || {};
        const resultUrls: Record<string, string> = Object.fromEntries(Object.entries(urls).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && !!entry[1]));
        const resultUrl = data.finalUrl || data.final_url || data.imageUrl || data.image_url || Object.values(resultUrls)[0];
        if (data.status === 'completed' && resultUrl) {
          setResultUrls(resultUrls);
          setResultUrl(resultUrl);
          setStatus('completed');
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

  useEffect(() => clearPolling, [clearPolling]);

  return { status, ticketId, resultUrl, resultUrls, error, startPolling, stopPolling };
};
