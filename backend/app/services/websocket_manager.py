"""WebSocket connection manager for RRG real-time updates."""

import asyncio
import logging
from typing import Dict, Set, Optional
from datetime import datetime
import json

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages WebSocket connections for RRG updates."""

    def __init__(self):
        # Store active connections: {connection_id: websocket}
        self.active_connections: Dict[str, WebSocket] = {}
        # Store subscription info: {connection_id: {symbols, benchmark, period}}
        self.subscriptions: Dict[str, dict] = {}
        # Background task for sending updates
        self._update_task: Optional[asyncio.Task] = None
        self._running = False

    async def connect(self, websocket: WebSocket, connection_id: str) -> bool:
        """Accept WebSocket connection."""
        try:
            await websocket.accept()
            self.active_connections[connection_id] = websocket
            logger.info(f"WebSocket connection accepted: {connection_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to accept WebSocket connection: {e}")
            return False

    def disconnect(self, connection_id: str):
        """Remove connection from manager."""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        if connection_id in self.subscriptions:
            del self.subscriptions[connection_id]
        logger.info(f"WebSocket connection removed: {connection_id}")

    def subscribe(self, connection_id: str, symbols: list, benchmark: str, period: str):
        """Register subscription for a connection."""
        self.subscriptions[connection_id] = {
            "symbols": symbols,
            "benchmark": benchmark,
            "period": period,
        }
        logger.info(f"Subscription registered for {connection_id}: {symbols} vs {benchmark} ({period})")

    async def send_message(self, connection_id: str, message: dict):
        """Send message to specific connection."""
        websocket = self.active_connections.get(connection_id)
        if websocket:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send message to {connection_id}: {e}")
                self.disconnect(connection_id)

    async def broadcast(self, message: dict):
        """Broadcast message to all active connections."""
        disconnected = []
        for connection_id, websocket in list(self.active_connections.items()):
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to broadcast to {connection_id}: {e}")
                disconnected.append(connection_id)

        # Clean up disconnected clients
        for connection_id in disconnected:
            self.disconnect(connection_id)

    def get_update_interval(self, period: str) -> int:
        """Get update interval in seconds based on period."""
        if period == "daily":
            return 60  # 1 minute for daily data
        return 300  # 5 minutes for weekly data


# Global manager instance
manager = WebSocketManager()
