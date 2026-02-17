package com.fitgotchi.app;

import android.util.Log;

import androidx.annotation.NonNull;

import com.android.billingclient.api.*;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "FitGotchiIAP")
public class FitGotchiIAPPlugin extends Plugin {

    private static final String TAG = "FitGotchiIAP";

    private BillingClient billingClient;
    private final Map<String, ProductDetails> productDetailsMap = new HashMap<>();
    private PluginCall pendingPurchaseCall;

    // MARK: - Initialize

    @PluginMethod
    public void initialize(PluginCall call) {
        billingClient = BillingClient.newBuilder(getContext())
                .setListener(this::onPurchasesUpdated)
                .enablePendingPurchases()
                .build();

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    Log.d(TAG, "Billing client connected");
                    loadProducts(call);
                } else {
                    call.reject("Billing setup failed: " + billingResult.getDebugMessage());
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                Log.w(TAG, "Billing service disconnected");
            }
        });
    }

    private void loadProducts(PluginCall call) {
        JSArray productsArray = call.getArray("products");
        if (productsArray == null) {
            call.reject("Missing products array");
            return;
        }

        List<QueryProductDetailsParams.Product> subProducts = new ArrayList<>();
        List<QueryProductDetailsParams.Product> inapProducts = new ArrayList<>();

        try {
            for (int i = 0; i < productsArray.length(); i++) {
                JSONObject product = productsArray.getJSONObject(i);
                String id = product.getString("id");
                String type = product.optString("type", "consumable");

                if ("subscription".equals(type)) {
                    subProducts.add(QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(id)
                            .setProductType(BillingClient.ProductType.SUBS)
                            .build());
                } else {
                    inapProducts.add(QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(id)
                            .setProductType(BillingClient.ProductType.INAPP)
                            .build());
                }
            }
        } catch (JSONException e) {
            call.reject("Invalid products format: " + e.getMessage());
            return;
        }

        final int[] pendingQueries = { 0 };

        if (!subProducts.isEmpty()) {
            pendingQueries[0]++;
            QueryProductDetailsParams subParams = QueryProductDetailsParams.newBuilder()
                    .setProductList(subProducts)
                    .build();
            billingClient.queryProductDetailsAsync(subParams, (result, details) -> {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && details != null) {
                    for (ProductDetails pd : details) {
                        productDetailsMap.put(pd.getProductId(), pd);
                    }
                }
                pendingQueries[0]--;
                if (pendingQueries[0] <= 0) resolveInit(call);
            });
        }

        if (!inapProducts.isEmpty()) {
            pendingQueries[0]++;
            QueryProductDetailsParams inapParams = QueryProductDetailsParams.newBuilder()
                    .setProductList(inapProducts)
                    .build();
            billingClient.queryProductDetailsAsync(inapParams, (result, details) -> {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && details != null) {
                    for (ProductDetails pd : details) {
                        productDetailsMap.put(pd.getProductId(), pd);
                    }
                }
                pendingQueries[0]--;
                if (pendingQueries[0] <= 0) resolveInit(call);
            });
        }

        if (subProducts.isEmpty() && inapProducts.isEmpty()) {
            resolveInit(call);
        }
    }

    private void resolveInit(PluginCall call) {
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("productCount", productDetailsMap.size());
        call.resolve(result);
    }

    // MARK: - Purchase

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        if (productId == null) {
            call.reject("Missing productId");
            return;
        }

        ProductDetails productDetails = productDetailsMap.get(productId);
        if (productDetails == null) {
            call.reject("Product not found: " + productId + ". Was initialize() called?");
            return;
        }

        pendingPurchaseCall = call;

        List<BillingFlowParams.ProductDetailsParams> paramsList = new ArrayList<>();

        BillingFlowParams.ProductDetailsParams.Builder paramsBuilder =
                BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(productDetails);

        // For subscriptions, we need to set the offer token
        if (productDetails.getProductType().equals(BillingClient.ProductType.SUBS)) {
            List<ProductDetails.SubscriptionOfferDetails> offers = productDetails.getSubscriptionOfferDetails();
            if (offers != null && !offers.isEmpty()) {
                paramsBuilder.setOfferToken(offers.get(0).getOfferToken());
            }
        }

        paramsList.add(paramsBuilder.build());

        BillingFlowParams billingFlowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(paramsList)
                .build();

        BillingResult result = billingClient.launchBillingFlow(getActivity(), billingFlowParams);

        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            pendingPurchaseCall = null;
            call.reject("Launch billing flow failed: " + result.getDebugMessage());
        }
    }

    private void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        if (pendingPurchaseCall == null) return;

        PluginCall call = pendingPurchaseCall;
        pendingPurchaseCall = null;

        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase purchase : purchases) {
                // Acknowledge the purchase
                if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    if (!purchase.isAcknowledged()) {
                        AcknowledgePurchaseParams ackParams = AcknowledgePurchaseParams.newBuilder()
                                .setPurchaseToken(purchase.getPurchaseToken())
                                .build();
                        billingClient.acknowledgePurchase(ackParams, ackResult -> {
                            Log.d(TAG, "Purchase acknowledged: " + ackResult.getResponseCode());
                        });
                    }

                    // For consumable products, consume them so they can be purchased again
                    String type = call.getString("type");
                    if ("consumable".equals(type)) {
                        ConsumeParams consumeParams = ConsumeParams.newBuilder()
                                .setPurchaseToken(purchase.getPurchaseToken())
                                .build();
                        billingClient.consumeAsync(consumeParams, (consumeResult, token) -> {
                            Log.d(TAG, "Purchase consumed: " + consumeResult.getResponseCode());
                        });
                    }

                    JSObject result = new JSObject();
                    result.put("success", true);
                    result.put("receipt", purchase.getOriginalJson());
                    result.put("signature", purchase.getSignature());
                    result.put("transactionId", purchase.getOrderId());
                    result.put("productId", purchase.getProducts().get(0));
                    result.put("purchaseToken", purchase.getPurchaseToken());
                    result.put("purchaseDate", String.valueOf(purchase.getPurchaseTime()));
                    call.resolve(result);
                    return;
                }
            }
        } else if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            JSObject result = new JSObject();
            result.put("cancelled", true);
            call.resolve(result);
        } else {
            call.reject("Purchase failed: " + billingResult.getDebugMessage());
        }
    }

    // MARK: - Restore Purchases

    @PluginMethod
    public void restorePurchases(PluginCall call) {
        // Query subscriptions
        billingClient.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder()
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build(),
                (subResult, subPurchases) -> {
                    // Then query in-app purchases
                    billingClient.queryPurchasesAsync(
                            QueryPurchasesParams.newBuilder()
                                    .setProductType(BillingClient.ProductType.INAPP)
                                    .build(),
                            (inapResult, inapPurchases) -> {
                                JSONArray allPurchases = new JSONArray();

                                for (Purchase p : subPurchases) {
                                    if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                        JSONObject obj = new JSONObject();
                                        try {
                                            obj.put("productId", p.getProducts().get(0));
                                            obj.put("type", "subscription");
                                            obj.put("receipt", p.getOriginalJson());
                                            obj.put("signature", p.getSignature());
                                            obj.put("transactionId", p.getOrderId());
                                            obj.put("purchaseDate", String.valueOf(p.getPurchaseTime()));
                                            allPurchases.put(obj);
                                        } catch (JSONException ignored) {}
                                    }
                                }

                                for (Purchase p : inapPurchases) {
                                    if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                        JSONObject obj = new JSONObject();
                                        try {
                                            obj.put("productId", p.getProducts().get(0));
                                            obj.put("type", "non_consumable");
                                            obj.put("receipt", p.getOriginalJson());
                                            obj.put("signature", p.getSignature());
                                            obj.put("transactionId", p.getOrderId());
                                            obj.put("purchaseDate", String.valueOf(p.getPurchaseTime()));
                                            allPurchases.put(obj);
                                        } catch (JSONException ignored) {}
                                    }
                                }

                                JSObject result = new JSObject();
                                result.put("success", true);
                                try {
                                    result.put("purchases", JSArray.from(allPurchases.toString()));
                                } catch (JSONException e) {
                                    result.put("purchases", new JSArray());
                                }
                                call.resolve(result);
                            });
                });
    }

    // MARK: - Get Product Info

    @PluginMethod
    public void getProductInfo(PluginCall call) {
        String productId = call.getString("productId");
        if (productId == null) {
            call.reject("Missing productId");
            return;
        }

        ProductDetails details = productDetailsMap.get(productId);
        if (details == null) {
            call.reject("Product not found: " + productId);
            return;
        }

        JSObject result = new JSObject();
        result.put("id", details.getProductId());
        result.put("title", details.getTitle());
        result.put("description", details.getDescription());

        // Get pricing info
        if (details.getProductType().equals(BillingClient.ProductType.SUBS)) {
            List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
            if (offers != null && !offers.isEmpty()) {
                ProductDetails.PricingPhase phase = offers.get(0).getPricingPhases()
                        .getPricingPhaseList().get(0);
                result.put("price", phase.getFormattedPrice());
                result.put("priceValue", phase.getPriceAmountMicros() / 1_000_000.0);
                result.put("currencyCode", phase.getPriceCurrencyCode());
            }
        } else {
            ProductDetails.OneTimePurchaseOfferDetails oneTime = details.getOneTimePurchaseOfferDetails();
            if (oneTime != null) {
                result.put("price", oneTime.getFormattedPrice());
                result.put("priceValue", oneTime.getPriceAmountMicros() / 1_000_000.0);
                result.put("currencyCode", oneTime.getPriceCurrencyCode());
            }
        }

        call.resolve(result);
    }
}
