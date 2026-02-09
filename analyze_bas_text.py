import re

def parse_bas_text():
    total_g1 = 0.0          # Sales (Stripe)
    expenses_with_gst = 0.0 # Rent, Ads, Soft
    expenses_no_gst = 0.0   # Bank Fees, Private

    # Keywords
    SALES_KW = ["STRIPE", "DEPOSIT", "CREDIT"]
    EXP_GST_KW = ["FACEBOOK", "GOOGLE", "DBRE", "WIX", "CURSOR", "MICROSOFT", "TRAINERIZE", "TPG", "MOBILE", "NETFLIX", "SPOTIFY", "AMAZON", "ADOBE", "MANYCHAT", "SQUASH", "UBER", "TAXI", "OFFICE", "POST", "LOCKSMITH", "IQUMULATE", "INSURANCE", "NIB", "ORIGIN", "ENERGY", "FEES"] 
    # Note: Fees usually have input tax credits if business related, but intl fees might not. We'll claim them as safest approach or exclude if strictly "Bank Fee". Actually "Intl Txn Fee" usually no GST. Let's be careful.
    # Rent (DBRE) definitely GST.
    
    # Exclude private/internal
    EXCLUDE_KW = ["INTERNAL", "TRANSFER", "IGA ", "WOOLWORTHS", "COLES", "GROCER", "ALDI", "LIQUOR", "CHEMIST", "PHARMACY", "DOCTOR", "DENTIST", "GYM", "FITNESS", "EMF", "BAYSIDE", "CHICKEN", "BURLEIGH", "ZAMBRERO", "MC DONALDS", "KFC", "REDY EXPRESS", "SHELL", "BP ", "7-ELEVEN", "AMPOL", "FUEL", "CAFE", "RESTAURANT", "BAR", "PUB", "EATS", "DELIV"]

    with open('jul_sep_data.txt', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    for line in lines:
        parts = line.split('\t')
        if len(parts) < 3: continue

        date_str = parts[0].strip()
        desc = parts[1].strip()
        amt_str = parts[2].strip().replace('−', '-').replace('+', '').replace('$', '').replace(',', '')
        
        try:
            amount = float(amt_str)
        except:
            continue

        desc_upper = desc.upper()

        # INCOME
        if amount > 0:
            # Check if it looks like business income
            if "STRIPE" in desc_upper or "DEPOSIT" in desc_upper or "PTY LTD" in desc_upper:
                 # Exclude Internal
                 if "INTERNAL" not in desc_upper and "LINKED" not in desc_upper:
                     total_g1 += amount
            continue

        # EXPENSES (Negative)
        val = abs(amount)
        
        # 1. Check exclusions first (Groceries, etc)
        is_excluded = False
        for kw in EXCLUDE_KW:
            if kw in desc_upper:
                is_excluded = True
                break
        
        if is_excluded:
            expenses_no_gst += val
            continue

        # 2. Check known Business Expenses (Rule of Inclusion)
        is_business = False
        for kw in EXP_GST_KW:
            if kw in desc_upper:
                is_business = True
                break
        
        # Rent check again to be sure
        if "DBRE" in desc_upper: is_business = True
        
        if is_business:
            # Special case: Intl Fees often No GST. 
            # But let's assume if it's "Fees" it might be exempt.
            # Actually, standard logic: 
            # Rent, Ads (Fb/Google charge GST in AU now), Software = GST.
            expenses_with_gst += val
        else:
            # Unsure? Put in no_gst to be safe, or if it looks like a business name
            # Let's count as NO GST to be conservative
            expenses_no_gst += val

    # Calculate 1A (GST on Sales)
    # We assume all G1 is GST-inclusive
    gst_1a = total_g1 / 11

    # Calculate 1B (GST on Purchases)
    gst_1b = expenses_with_gst / 11

    print("-" * 50)
    print(f"BAS ESTIMATE (Jul-Sep 2025)")
    print("-" * 50)
    print(f"G1 (Total Sales):           ${total_g1:,.2f}")
    print(f"1A (GST on Sales):          ${gst_1a:,.2f}")
    print("-" * 50)
    print(f"G11 (Non-Capital Purch):    ${expenses_with_gst:,.2f}")
    print(f"1B (GST on Purchases):      ${gst_1b:,.2f}")
    print("-" * 50)
    print(f"PAYABLE AMOUNT:             ${(gst_1a - gst_1b):,.2f}")
    print("-" * 50)

if __name__ == "__main__":
    parse_bas_text()
