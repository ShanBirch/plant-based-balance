import stripe
import json

# Setup Stripe with the provided Secret Key
stripe.api_key = "os.getenv('STRIPE_SECRET_KEY') # Add your key to environment variables"

products_to_create = [
    {
        "name": "Vegan Perimenopause Reset (1 Month)",
        "amount": 4600, # $46.00 AUD
        "interval_count": 1
    },
    {
        "name": "Vegan Perimenopause Reset (3 Months)",
        "amount": 9300, # $93.00 AUD
        "interval_count": 3
    },
    {
        "name": "Vegan Perimenopause Reset (6 Months)",
        "amount": 10800, # $108.00 AUD
        "interval_count": 6
    }
]

created_prices = {}

try:
    print("Creating Products and Prices...")
    for item in products_to_create:
        # Create Product
        product = stripe.Product.create(name=item["name"])
        
        # Create Price
        price = stripe.Price.create(
            unit_amount=item["amount"],
            currency="aud",
            recurring={"interval": "month", "interval_count": item["interval_count"]},
            product=product.id,
        )
        
        # Map for output
        key = f"{item['interval_count']}-month"
        created_prices[key] = price.id
        print(f"Created {item['name']}: {price.id}")

    print("\nJSON Output for checkout.js:")
    print(json.dumps(created_prices, indent=4))

except Exception as e:
    print(f"Error: {e}")
