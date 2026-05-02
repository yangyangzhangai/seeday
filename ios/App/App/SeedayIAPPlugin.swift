import Foundation
import Capacitor
import StoreKit

/// Capacitor bridge plugin for Apple In-App Purchases (StoreKit 2).
/// Exposed to JS as window.Capacitor.Plugins.SeedayIAP
/// Methods: purchaseProduct, restorePurchases
@objc(SeedayIAP)
public class SeedayIAPPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SeedayIAP"
    public let jsName = "SeedayIAP"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "purchaseProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
    ]
    private var transactionUpdatesTask: Task<Void, Never>?

    public override func load() {
        super.load()
        startTransactionUpdatesListenerIfNeeded()
    }

    deinit {
        transactionUpdatesTask?.cancel()
    }

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

    // MARK: - Transaction updates

    private func startTransactionUpdatesListenerIfNeeded() {
        guard transactionUpdatesTask == nil else { return }

        transactionUpdatesTask = Task.detached(priority: .background) { [weak self] in
            for await result in Transaction.updates {
                if Task.isCancelled { break }

                switch result {
                case .verified(let transaction):
                    await transaction.finish()
                    let payload = Self.makeTransactionPayload(transaction)
                    await MainActor.run {
                        self?.notifyListeners("iapTransactionUpdated", data: payload)
                    }
                case .unverified(_, let error):
                    CAPLog.print("⚡️  SeedayIAP: unverified transaction update: \(error.localizedDescription)")
                }
            }
        }
    }

    private static func makeTransactionPayload(_ transaction: Transaction) -> [String: Any] {
        [
            "transactionId": String(transaction.id),
            "originalTransactionId": String(transaction.originalID),
            "productId": transaction.productID,
            "purchaseDateMs": Int(transaction.purchaseDate.timeIntervalSince1970 * 1000),
        ]
    }
}
