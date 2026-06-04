from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
import logging

import anyio
from supabase import Client
from postgrest.exceptions import APIError

from app.database.supabase_client import get_supabase_admin_client, get_supabase_client

logger = logging.getLogger(__name__)


class DBOperationError(Exception):
    """Structured error for DB operations with context."""
    def __init__(
        self,
        message: str,
        operation: str,
        table: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        original_error: Optional[Exception] = None,
    ):
        self.message = message
        self.operation = operation
        self.table = table
        self.filters = filters
        self.original_error = original_error
        super().__init__(self.message)


class SupabaseService:
    """Async-friendly wrapper around the (sync) Supabase Python client.

    Supabase client operations are executed in a worker thread to avoid blocking
    the event loop.

    This is a foundation layer for future API migrations; it does not change the DB schema.
    """

    def __init__(self, *, admin: bool = False):
        self._client: Client = get_supabase_admin_client() if admin else get_supabase_client()

    @property
    def client(self) -> Client:
        return self._client

    async def select(
        self,
        table: str,
        *,
        columns: str = "*",
        filters: Optional[Dict[str, Any]] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        def _run():
            q = self._client.table(table).select(columns)
            if filters:
                for k, v in filters.items():
                    q = q.eq(k, v)
            if limit is not None:
                q = q.limit(limit)
            res = q.execute()
            return res.data or []

        return await anyio.to_thread.run_sync(_run)

    async def select_safe(
        self,
        table: str,
        *,
        columns: str = "*",
        filters: Optional[Dict[str, Any]] = None,
        limit: Optional[int] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[Dict[str, Any]], Optional[DBOperationError]]:
        """Safe select that never throws. Returns (data, error) tuple."""
        context = context or {}
        def _run():
            try:
                q = self._client.table(table).select(columns)
                if filters:
                    for k, v in filters.items():
                        q = q.eq(k, v)
                if limit is not None:
                    q = q.limit(limit)
                res = q.execute()
                data = res.data or []
                return data, None
            except APIError as e:
                logger.error(
                    "[db.select_safe] postgrest_error table=%s columns=%s filters=%s limit=%s error=%s context=%s",
                    str(table),
                    str(columns),
                    str(filters),
                    str(limit),
                    str(e),
                    str(context),
                )
                return [], DBOperationError(
                    message=f"Database query failed: {str(e)}",
                    operation="select",
                    table=table,
                    filters=filters,
                    original_error=e,
                )
            except Exception as e:
                logger.error(
                    "[db.select_safe] unexpected_error table=%s columns=%s filters=%s limit=%s error=%s context=%s",
                    str(table),
                    str(columns),
                    str(filters),
                    str(limit),
                    str(e),
                    str(context),
                )
                return [], DBOperationError(
                    message=f"Unexpected database error: {str(e)}",
                    operation="select",
                    table=table,
                    filters=filters,
                    original_error=e,
                )

        return await anyio.to_thread.run_sync(_run)

    async def insert(self, table: str, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        def _run():
            res = self._client.table(table).insert(rows).execute()
            return res.data or []

        return await anyio.to_thread.run_sync(_run)

    async def insert_safe(
        self,
        table: str,
        rows: List[Dict[str, Any]],
        *,
        context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[Dict[str, Any]], Optional[DBOperationError]]:
        """Safe insert that never throws. Returns (data, error) tuple."""
        context = context or {}
        def _run():
            try:
                res = self._client.table(table).insert(rows).execute()
                data = res.data or []
                return data, None
            except APIError as e:
                logger.error(
                    "[db.insert_safe] postgrest_error table=%s rows_count=%s error=%s context=%s",
                    str(table),
                    str(len(rows)),
                    str(e),
                    str(context),
                )
                return [], DBOperationError(
                    message=f"Database insert failed: {str(e)}",
                    operation="insert",
                    table=table,
                    original_error=e,
                )
            except Exception as e:
                logger.error(
                    "[db.insert_safe] unexpected_error table=%s rows_count=%s error=%s context=%s",
                    str(table),
                    str(len(rows)),
                    str(e),
                    str(context),
                )
                return [], DBOperationError(
                    message=f"Unexpected database error: {str(e)}",
                    operation="insert",
                    table=table,
                    original_error=e,
                )

        return await anyio.to_thread.run_sync(_run)

    async def update(
        self,
        table: str,
        values: Dict[str, Any],
        *,
        filters: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        def _run():
            q = self._client.table(table).update(values)
            for k, v in filters.items():
                q = q.eq(k, v)
            res = q.execute()
            return res.data or []

        return await anyio.to_thread.run_sync(_run)

    async def update_safe(
        self,
        table: str,
        values: Dict[str, Any],
        *,
        filters: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[Dict[str, Any]], Optional[DBOperationError]]:
        """Safe update that never throws. Returns (data, error) tuple."""
        context = context or {}
        def _run():
            try:
                q = self._client.table(table).update(values)
                for k, v in filters.items():
                    q = q.eq(k, v)
                res = q.execute()
                data = res.data or []
                return data, None
            except APIError as e:
                logger.error(
                    "[db.update_safe] postgrest_error table=%s filters=%s values_keys=%s error=%s context=%s",
                    str(table),
                    str(filters),
                    str(list(values.keys())),
                    str(e),
                    str(context),
                )
                return [], DBOperationError(
                    message=f"Database update failed: {str(e)}",
                    operation="update",
                    table=table,
                    filters=filters,
                    original_error=e,
                )
            except Exception as e:
                logger.error(
                    "[db.update_safe] unexpected_error table=%s filters=%s values_keys=%s error=%s context=%s",
                    str(table),
                    str(filters),
                    str(list(values.keys())),
                    str(e),
                    str(context),
                )
                return [], DBOperationError(
                    message=f"Unexpected database error: {str(e)}",
                    operation="update",
                    table=table,
                    filters=filters,
                    original_error=e,
                )

        return await anyio.to_thread.run_sync(_run)

    async def rpc(self, fn: str, params: Dict[str, Any]) -> Any:
        def _run():
            res = self._client.rpc(fn, params).execute()
            return res.data

        return await anyio.to_thread.run_sync(_run)

    async def run(self, fn, retries: int = 3):
        """Run an arbitrary sync Supabase operation in a worker thread with retries."""
        import httpx
        
        for attempt in range(retries):
            try:
                return await anyio.to_thread.run_sync(fn)
            except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout, httpx.ReadError) as e:
                if attempt == retries - 1:
                    logger.error("[db.run] Failed after %d attempts. Final error: %s", retries, e)
                    raise
                logger.warning(
                    "[db.run] Supabase connection error: %s. Retrying %d/%d...", 
                    type(e).__name__, attempt + 1, retries - 1
                )
                await anyio.sleep(0.5 * (2 ** attempt))

    async def run_safe(
        self,
        fn,
        *,
        operation: str,
        table: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Any, Optional[DBOperationError]]:
        """Safe run that never throws. Returns (result, error) tuple."""
        context = context or {}
        def _run():
            try:
                result = fn()
                return result, None
            except APIError as e:
                logger.error(
                    "[db.run_safe] postgrest_error operation=%s table=%s error=%s context=%s",
                    str(operation),
                    str(table),
                    str(e),
                    str(context),
                )
                return None, DBOperationError(
                    message=f"Database operation failed: {str(e)}",
                    operation=operation,
                    table=table,
                    original_error=e,
                )
            except Exception as e:
                logger.error(
                    "[db.run_safe] unexpected_error operation=%s table=%s error=%s context=%s",
                    str(operation),
                    str(table),
                    str(e),
                    str(context),
                )
                return None, DBOperationError(
                    message=f"Unexpected database error: {str(e)}",
                    operation=operation,
                    table=table,
                    original_error=e,
                )

        return await anyio.to_thread.run_sync(_run)


def get_db_service() -> SupabaseService:
    return SupabaseService(admin=False)


def get_db_admin_service() -> SupabaseService:
    return SupabaseService(admin=True)
