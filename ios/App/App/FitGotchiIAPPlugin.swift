import Foundation
import Capacitor
import StoreKit

@objc(FitGotchiIAPPlugin)
public class FitGotchiIAPPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FitGotchiIAPPlugin"
    public let jsName = "FitGotchiIAP"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProductInfo", returnType: CAPPluginReturnPromise)
    ]

    private var products: [String: Product] = [:]

    // MARK: - Initialize

    @objc func initialize(_ call: CAPPluginCall) {
        guard let productList = call.getArray("products") as? [[String: String]] else {
            call.reject("Missing products array")
            return
        }

        let productIds = productList.compactMap { $0["id"] }

        Task {
            do {
                let storeProducts = try await Product.products(for: Set(productIds))
                for product in storeProducts {
                    self.products[product.id] = product
                }
                call.resolve([
                    "success": true,
                    "productCount": storeProducts.count
                ])
            } catch {
                call.reject("Failed to load products: \(error.localizedDescription)")
            }
        }

        // Listen for transaction updates (renewals, refunds, etc.)
        Task {
            for await result in Transaction.updates {
                if case .verified(let transaction) = result {
                    await transaction.finish()
                }
            }
        }
    }

    // MARK: - Purchase

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("Missing productId")
            return
        }

        guard let product = products[productId] else {
            call.reject("Product not found: \(productId). Was initialize() called?")
            return
        }

        Task {
            do {
                let result = try await product.purchase()

                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        // Get the receipt/JWS for server validation
                        let receiptData: [String: Any] = [
                            "success": true,
                            "receipt": verification.jwsRepresentation,
                            "transactionId": String(transaction.id),
                            "productId": transaction.productID,
                            "purchaseDate": ISO8601DateFormatter().string(from: transaction.purchaseDate),
                            "expirationDate": transaction.expirationDate.map { ISO8601DateFormatter().string(from: $0) } ?? ""
                        ]
                        await transaction.finish()
                        call.resolve(receiptData)

                    case .unverified(_, let error):
                        call.reject("Transaction unverified: \(error.localizedDescription)")
                    }

                case .userCancelled:
                    call.resolve(["cancelled": true])

                case .pending:
                    call.resolve(["pending": true])

                @unknown default:
                    call.reject("Unknown purchase result")
                }
            } catch {
                call.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Restore Purchases

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()

                var restoredPurchases: [[String: Any]] = []

                for await result in Transaction.currentEntitlements {
                    if case .verified(let transaction) = result {
                        restoredPurchases.append([
                            "productId": transaction.productID,
                            "type": transaction.productType == .autoRenewable ? "subscription" : "non_consumable",
                            "receipt": result.jwsRepresentation,
                            "transactionId": String(transaction.id),
                            "purchaseDate": ISO8601DateFormatter().string(from: transaction.purchaseDate)
                        ])
                    }
                }

                call.resolve([
                    "success": true,
                    "purchases": restoredPurchases
                ])
            } catch {
                call.reject("Restore failed: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Get Product Info

    @objc func getProductInfo(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("Missing productId")
            return
        }

        guard let product = products[productId] else {
            call.reject("Product not found: \(productId)")
            return
        }

        call.resolve([
            "id": product.id,
            "title": product.displayName,
            "description": product.description,
            "price": product.displayPrice,
            "priceValue": NSDecimalNumber(decimal: product.price).doubleValue,
            "currencyCode": product.priceFormatStyle.currencyCode
        ])
    }
}
