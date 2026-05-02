import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var hasRegisteredSeedayIAP = false
    private var iapRegistrationRetryCount = 0
    private let maxIAPRegistrationRetries = 30

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Capacitor 7 does not emit a "capacitorDidLoad" notification.
        // Register the in-app IAP bridge once the bridge view controller becomes available.
        scheduleSeedayIAPRegistrationIfNeeded()
        DispatchQueue.main.async { [weak self] in
            self?.applyWebViewScrollBehavior()
        }
        excludeWebKitStorageFromBackup()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        applyWebViewScrollBehavior()
        scheduleSeedayIAPRegistrationIfNeeded()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    private func applyWebViewScrollBehavior() {
        guard let bridgeVC = findBridgeViewController(from: window?.rootViewController),
              let webView = bridgeVC.bridge?.webView else {
            return
        }

        #if DEBUG
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }
        #endif

        let scrollView = webView.scrollView
        scrollView.bounces = false
        scrollView.alwaysBounceVertical = false
        scrollView.showsVerticalScrollIndicator = false
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.keyboardDismissMode = .interactive
        if #available(iOS 11.0, *) {
            scrollView.contentInsetAdjustmentBehavior = .never
        }
    }

    private func findBridgeViewController(from root: UIViewController?) -> CAPBridgeViewController? {
        guard let root else { return nil }

        if let bridgeVC = root as? CAPBridgeViewController {
            return bridgeVC
        }

        if let nav = root as? UINavigationController {
            for controller in nav.viewControllers {
                if let match = findBridgeViewController(from: controller) {
                    return match
                }
            }
        }

        if let tab = root as? UITabBarController {
            for controller in tab.viewControllers ?? [] {
                if let match = findBridgeViewController(from: controller) {
                    return match
                }
            }
        }

        if let presented = root.presentedViewController,
           let match = findBridgeViewController(from: presented) {
            return match
        }

        for child in root.children {
            if let match = findBridgeViewController(from: child) {
                return match
            }
        }

        return nil
    }

    private func scheduleSeedayIAPRegistrationIfNeeded() {
        guard !hasRegisteredSeedayIAP else { return }

        guard let bridgeVC = findBridgeViewController(from: window?.rootViewController),
              let bridge = bridgeVC.bridge else {
            retrySeedayIAPRegistrationIfNeeded()
            return
        }

        if bridge.plugin(withName: "SeedayIAP") == nil {
            bridge.registerPluginInstance(SeedayIAPPlugin())
        }

        hasRegisteredSeedayIAP = true
    }

    private func retrySeedayIAPRegistrationIfNeeded() {
        guard !hasRegisteredSeedayIAP else { return }
        guard iapRegistrationRetryCount < maxIAPRegistrationRetries else { return }

        iapRegistrationRetryCount += 1
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
            self?.scheduleSeedayIAPRegistrationIfNeeded()
        }
    }

    // Exclude WKWebView's localStorage from iCloud backup.
    // All user data in these directories is synced to Supabase and recoverable
    // after login, so including it in backups wastes space with no user benefit.
    // Preferences (NSUserDefaults) are intentionally kept to preserve auth session
    // and reminder settings across device restores.
    private func excludeWebKitStorageFromBackup() {
        let manager = FileManager.default
        guard let libraryURL = manager.urls(for: .libraryDirectory, in: .userDomainMask).first else { return }
        setExcludedFromBackup(at: libraryURL.appendingPathComponent("WebKit"))
    }

    private func setExcludedFromBackup(at url: URL) {
        var url = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? url.setResourceValues(values)
    }

}
