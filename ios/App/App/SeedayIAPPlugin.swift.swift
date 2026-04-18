import Foundation
import Capacitor
import StoreKit

/// Capacitor bridge plugin for Apple In-App Purchases (StoreKit 2).
/// Exposed to JS as window.Capacitor.Plugins.SeedayIAP
/// Methods: purchaseProduct, restorePurchases
@objc(SeedayIAP)
public class SeedayIAPPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SeedayIAPPlugin"
    public let jsName = "SeedayIAP"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "purchaseProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
    ]

    // MARK: - purchaseProduct

    @objc func purchaseProduct(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"), !productId.isEmpty else {
            call.reject("Missing productId")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("Product not found: \(productId)")
                    return
                }

                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        await transaction.finish()
                        call.resolve([
                            "transactionId": String(transaction.id),
                            "originalTransactionId": String(transaction.originalID),
                            "productId": transaction.productID,
                        ])
                    case .unverified(_, let error):
                        call.reject("Unverified transaction: \(error.localizedDescription)")
                    }
                case .userCancelled:
                    call.reject("User cancelled purchase")
                case .pending:
                    call.reject("Purchase pending parental approval")
                @unknown default:
                    call.reject("Unknown purchase result")
                }
            } catch {
                call.reject("Purchase error: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - restorePurchases

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            var latestTransaction: Transaction? = nil
            var latestDate = Date.distantPast

            for await result in Transaction.currentEntitlements {
                if case .verified(let transaction) = result {
                    if transaction.purchaseDate > latestDate {
                        latestDate = transaction.purchaseDate
                        latestTransaction = transaction
                    }
                }
            }

            if let transaction = latestTransaction {
                call.resolve([
                    "transactionId": String(transaction.id),
                    "originalTransactionId": String(transaction.originalID),
                    "productId": transaction.productID,
                ])
            } else {
                call.reject("No active subscriptions found")
            }
        }
    }
}
