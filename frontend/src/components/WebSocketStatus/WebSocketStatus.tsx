/**
 * WebSocket Status Indicator Component
 * Shows connection status for WebSocket
 */

import React from 'react';
import './WebSocketStatus.css';

interface WebSocketStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  isPaused?: boolean;
  error: Error | null;
  onReconnect: () => void;
}

export const WebSocketStatus: React.FC<WebSocketStatusProps> = ({
  isConnected,
  isConnecting,
  isPaused = false,
  error,
  onReconnect,
}) => {
  const getStatusText = () => {
    if (isPaused) return 'In pausa';
    if (error) return 'Errore';
    if (isConnecting) return 'Connessione...';
    if (isConnected) return 'Connesso';
    return 'Disconnesso';
  };

  const getStatusClass = () => {
    if (isPaused) return 'ws-status--paused';
    if (error) return 'ws-status--error';
    if (isConnecting) return 'ws-status--connecting';
    if (isConnected) return 'ws-status--connected';
    return 'ws-status--disconnected';
  };

  return (
    <div className={`ws-status ${getStatusClass()}`}>
      <span className="ws-status-dot" />
      <span className="ws-status-text">{getStatusText()}</span>
      {error && (
        <button className="ws-reconnect-btn" onClick={onReconnect}>
          Riprova
        </button>
      )}
    </div>
  );
};
