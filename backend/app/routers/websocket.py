"""WebSocket router for real-time RRG updates."""

import asyncio
import logging
from datetime import datetime
from typing import Optional
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from fastapi.websockets import WebSocketState

from app.services.websocket_manager import manager
from app.services.rrg_calculator import calculate_rrg_for_symbols
from app.services.data_fetcher import DataFetchError, SymbolNotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ws", tags=["websocket"])


async def fetch_and_send_rrg(websocket: WebSocket, symbols: list, benchmark: str, period: str, connection_id: str):
    """Fetch RRG data and send via WebSocket."""
    try:
        data = await calculate_rrg_for_symbols(
            symbols=symbols,
            benchmark=benchmark,
            period=period,
            tail_length=12,
        )

        message = {
            "type": "rrg_update",
            "data": data,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

        await manager.send_message(connection_id, message)
        logger.info(f"Sent RRG update to {connection_id}")

    except (DataFetchError, SymbolNotFoundError) as e:
        error_message = {
            "type": "error",
            "message": str(e),
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        await manager.send_message(connection_id, error_message)
        logger.error(f"RRG fetch error for {connection_id}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error sending RRG update: {e}")


@router.websocket("/rrg")
async def websocket_rrg(
    websocket: WebSocket,
    symbols: str = Query(..., description="Comma-separated symbols"),
    benchmark: str = Query(default="SPY", description="Benchmark ticker"),
    period: str = Query(default="daily", description="Period: daily or weekly"),
):
    """
    WebSocket endpoint for real-time RRG updates.

    Clients connect and receive RRG data updates at regular intervals:
    - daily: updates every 60 seconds
    - weekly: updates every 5 minutes

    Message format:
    {
        "type": "rrg_update",
        "data": { ... RRG data ... },
        "timestamp": "2026-03-11T10:00:00Z"
    }
    """
    # Parse symbols
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]

    if not symbol_list:
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "message": "At least one symbol is required",
        })
        await websocket.close()
        return

    if len(symbol_list) > 20:
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "message": "Maximum 20 symbols allowed",
        })
        await websocket.close()
        return

    if period not in ("daily", "weekly"):
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "message": "Period must be 'daily' or 'weekly'",
        })
        await websocket.close()
        return

    # Generate connection ID
    connection_id = f"ws_{id(websocket)}_{datetime.utcnow().timestamp()}"

    # Connect
    connected = await manager.connect(websocket, connection_id)
    if not connected:
        return

    # Subscribe
    manager.subscribe(connection_id, symbol_list, benchmark, period)

    # Send initial data
    await websocket.send_json({
        "type": "connected",
        "connection_id": connection_id,
        "symbols": symbol_list,
        "benchmark": benchmark,
        "period": period,
        "message": "Connected to RRG WebSocket. Sending initial data...",
    })

    # Send initial RRG data
    await fetch_and_send_rrg(websocket, symbol_list, benchmark, period, connection_id)

    # Get update interval
    interval = manager.get_update_interval(period)

    try:
        while True:
            # Wait for update interval or message from client
            try:
                # Check if connection is still alive
                if websocket.client_state == WebSocketState.DISCONNECTED:
                    break

                # Wait for interval
                await asyncio.sleep(interval)

                # Send update
                await fetch_and_send_rrg(websocket, symbol_list, benchmark, period, connection_id)

            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected: {connection_id}")
                break
            except Exception as e:
                logger.error(f"Error in WebSocket loop: {e}")
                await asyncio.sleep(5)  # Wait before retry

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        manager.disconnect(connection_id)
        logger.info(f"WebSocket connection closed: {connection_id}")
