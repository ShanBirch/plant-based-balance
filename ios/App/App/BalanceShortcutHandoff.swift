import Foundation

enum BalanceShortcutHandoff {
    static let pendingActionKey = "pendingBalanceShortcutAction"

    static func store(_ action: String) {
        UserDefaults.standard.set(action, forKey: pendingActionKey)
        NotificationCenter.default.post(name: .balanceShortcutActionQueued, object: nil)
    }

    static func pendingAction() -> String? {
        guard let action = UserDefaults.standard.string(forKey: pendingActionKey),
              !action.isEmpty else {
            return nil
        }
        return action
    }

    static func clear(_ action: String) {
        guard UserDefaults.standard.string(forKey: pendingActionKey) == action else { return }
        UserDefaults.standard.removeObject(forKey: pendingActionKey)
    }

    static func action(forQuickActionType type: String) -> String? {
        switch type {
        case "com.fitgotchi.app.shortcut.workout":
            return "today-workout"
        case "com.fitgotchi.app.shortcut.workout-builder":
            return "workout-builder"
        case "com.fitgotchi.app.shortcut.coach":
            return "coach"
        case "com.fitgotchi.app.shortcut.meal-plan":
            return "meal-plan"
        case "com.fitgotchi.app.shortcut.quick-log":
            return "quick-log"
        case "com.fitgotchi.app.shortcut.character":
            return "fitgotchi"
        default:
            return nil
        }
    }

    static func action(forWidgetURL url: URL) -> String? {
        guard url.scheme == "com.fitgotchi.app" else { return nil }
        guard url.host == "shortcut" else { return nil }
        let action = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        switch action {
        case "calorie-tracker",
             "quick-log",
             "quick-log-photo",
             "barcode",
             "manual-log",
             "meal-builder",
             "recent-meals",
             "daily-quiz",
             "weigh-in",
             "mood-check":
            return action
        default:
            return nil
        }
    }
}

extension Notification.Name {
    static let balanceShortcutActionQueued = Notification.Name("BalanceShortcutActionQueued")
    static let balanceMetaTrialQueued = Notification.Name("BalanceMetaTrialQueued")
}

enum BalanceMetaTrialHandoff {
    private static let pendingQueryKey = "pendingBalanceMetaTrialQuery"

    static func store(url: URL) -> Bool {
        guard url.scheme == "com.fitgotchi.app", url.host == "meta-trial" else { return false }
        guard let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.percentEncodedQuery,
              !query.isEmpty else { return true }
        UserDefaults.standard.set(query, forKey: pendingQueryKey)
        NotificationCenter.default.post(name: .balanceMetaTrialQueued, object: nil)
        return true
    }

    static func pendingQuery() -> String? {
        UserDefaults.standard.string(forKey: pendingQueryKey)
    }

    static func clear(_ query: String) {
        guard UserDefaults.standard.string(forKey: pendingQueryKey) == query else { return }
        UserDefaults.standard.removeObject(forKey: pendingQueryKey)
    }
}
