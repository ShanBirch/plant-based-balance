import stripe
import json

# Setup Stripe with the Secret Key
stripe.api_key = "os.getenv('STRIPE_SECRET_KEY') # Add your key to environment variables"

full_price_products = [
    {
        "name": "28-Day Plant Based Switch (1 Month)",
        "amount": 9200, # $92.00 AUD (Full Price)
        "interval_count": 1
    },
    {
        "name": "28-Day Plant Based Switch (3 Months)",
        "amount": 18600, # $186.00 AUD (Full Price)
        "interval_count": 3
    },
    {
        "name": "28-Day Plant Based Switch (6 Months)",
        "amount": 21600, # $216.00 AUD (Full Price)
        "interval_count": 6
    }
]

created_results = {
    "prices": {},
    "coupon": None
}

try:
    print("Creating Full Price Products and Prices...")
    for item in full_price_products:
        product = stripe.Product.create(name=item["name"])
        price = stripe.Price.create(
            unit_amount=item["amount"],
            currency="aud",
            recurring={"interval": "month", "interval_count": item["interval_count"]},
            product=product.id,
        )
        key = f"{item['interval_count']}-month"
        created_results["prices"][key] = price.id
        print(f"Created {item['name']} (Full Price): {price.id}")

    print("\nCreating 50% OFF Coupon (Applies to first payment only)...")
    coupon = stripe.Coupon.create(
        percent_off=50,
        duration="once", # This is the magic part - first payment only
        name="50% First Payment Discount"
    )
    created_results["coupon"] = coupon.id
    print(f"Created Coupon: {coupon.id}")

    print("\n--- NEW STRIPE CONFIG ---")
    print(json.dumps(created_results, indent=4))

except Exception as e:
    print(f"Error: {e}")
