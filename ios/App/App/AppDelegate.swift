import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Register TshineIAP plugin before Capacitor bridge loads
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(capacitorDidLoad(_:)),
            name: Notification.Name("capacitorDidLoad"),
            object: nil
        )
        DispatchQueue.main.async { [weak self] in
            self?.applyWebViewScrollBehavior()
        }
        return true
    }

    @objc private func capacitorDidLoad(_ notification: Notification) {
        guard let vc = notification.object as? CAPBridgeViewController else { return }
        vc.bridge?.registerPluginInstance(TshineIAPPlugin())
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

}
