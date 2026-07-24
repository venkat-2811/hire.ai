from typing import Optional, Dict, Any
from app.core.context import UserContext
from app.services.db_admin import get_db_admin_service

class CreditService:
    """
    Centralized service for managing credit ledger transactions.
    Replaces all scattered deduction logic.
    """
    
    @staticmethod
    async def deduct(
        ctx: UserContext,
        action_type: str,
        amount: float,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Deducts credits atomically via the `deduct_credit_atomic` RPC.
        Returns an error string if deduction fails, or None on success.
        """
        db = get_db_admin_service()
        
        # Determine appropriate member_id if company context
        member_id = None
        if ctx.is_company_member:
            # We need the member_id to update company_members
            # We can extract it from the context if we cached the membership row
            # But the context might not have the raw membership row's ID if we only loaded company_data
            # Let's ensure context loads member_id
            
            # Since UserContext currently doesn't expose member_id explicitly, we can fetch it, 
            # or rely on the RPC to just use user_id + company_id to find the member row.
            # But our RPC expects p_member_id. 
            def _get_mid():
                return db.client.from_("company_members").select("id").eq("user_id", ctx.user_id).eq("company_id", ctx.company_id).maybe_single().execute()
            
            try:
                res = await db.run(_get_mid)
                data = getattr(res, "data", None)
                if data:
                    member_id = data.get("id")
            except Exception:
                pass
                
            if not member_id:
                return "Failed to resolve company membership for credit deduction."
                
        payload = {
            "p_user_id": ctx.user_id,
            "p_company_id": ctx.company_id,
            "p_action_type": action_type,
            "p_amount": amount,
            "p_metadata": metadata or {},
            "p_member_id": member_id
        }
        
        try:
            def _rpc():
                return db.client.rpc("deduct_credit_atomic", payload).execute()
            await db.run(_rpc)
            return None
        except Exception as e:
            err_msg = str(e).lower()
            if "limit exceeded" in err_msg:
                if ctx.is_company_member:
                    return "You have reached your company seat credit limit. Please ask your company owner to allocate more credits."
                else:
                    return "You have reached your individual candidate limit. Please upgrade your plan."
            return f"Credit deduction failed: {e}"
