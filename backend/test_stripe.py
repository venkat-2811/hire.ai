import asyncio
from app.api.v2.endpoints.billing import _create_stripe_checkout
from dotenv import load_dotenv

async def main():
    load_dotenv()
    try:
        session = await _create_stripe_checkout(
            plan_id="growth",
            label="Growth",
            amount_cents=2700000,
            success_url="http://localhost:8080/success",
            cancel_url="http://localhost:8080/cancel",
            currency="INR",
            interval="month",
            interval_count=6,
            metadata={"user_id": "test_user"}
        )
        print("Success:", session)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
