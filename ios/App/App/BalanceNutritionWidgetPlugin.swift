import Foundation
import Capacitor
import WidgetKit

@objc(BalanceNutritionWidgetPlugin)
public class BalanceNutritionWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BalanceNutritionWidgetPlugin"
    public let jsName = "BalanceNutritionWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveDailyQuizSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveWeighInSnapshot", returnType: CAPPluginReturnPromise)
    ]

    private let appGroupID = "group.com.fitgotchi.app"
    private let snapshotKey = "nutritionWidgetSnapshot"
    private let nutritionWidgetRangeKey = "nutritionWidgetRange"
    private let dailyQuizSnapshotKey = "dailyQuizWidgetSnapshot"
    private let weighInSnapshotKey = "weighInWidgetSnapshot"

    @objc func saveSnapshot(_ call: CAPPluginCall) {
        let snapshot: [String: Any] = [
            "date": call.getString("date") ?? Self.todayString(),
            "calories": Self.doubleValue(call, "calories", defaultValue: 0),
            "calorieGoal": Self.doubleValue(call, "calorieGoal", defaultValue: 2000),
            "protein": Self.doubleValue(call, "protein", defaultValue: 0),
            "proteinGoal": Self.doubleValue(call, "proteinGoal", defaultValue: 50),
            "carbs": Self.doubleValue(call, "carbs", defaultValue: 0),
            "carbsGoal": Self.doubleValue(call, "carbsGoal", defaultValue: 250),
            "fat": Self.doubleValue(call, "fat", defaultValue: 0),
            "fatGoal": Self.doubleValue(call, "fatGoal", defaultValue: 70),
            "mealCount": call.getInt("mealCount") ?? 0,
            "selectedRange": call.getString("selectedRange") ?? "day",
            "rangesJson": call.getString("rangesJson") ?? "",
            "updatedAt": Self.doubleValue(call, "updatedAt", defaultValue: Date().timeIntervalSince1970 * 1000)
        ]

        do {
            let data = try JSONSerialization.data(withJSONObject: snapshot, options: [])
            UserDefaults.standard.set(data, forKey: snapshotKey)
            UserDefaults.standard.set(snapshot["selectedRange"], forKey: nutritionWidgetRangeKey)

            guard let sharedDefaults = UserDefaults(suiteName: appGroupID) else {
                call.resolve(["success": false, "reason": "app-group-unavailable"])
                return
            }

            sharedDefaults.set(data, forKey: snapshotKey)
            sharedDefaults.set(snapshot["selectedRange"], forKey: nutritionWidgetRangeKey)
            sharedDefaults.synchronize()

            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadTimelines(ofKind: "BalanceNutritionWidget")
            }

            call.resolve(["success": true])
        } catch {
            call.reject("Could not save nutrition widget snapshot: \(error.localizedDescription)")
        }
    }

    @objc func saveDailyQuizSnapshot(_ call: CAPPluginCall) {
        saveJSONSnapshot(
            call,
            key: dailyQuizSnapshotKey,
            widgetKind: "BalanceDailyQuizWidget",
            errorLabel: "daily quiz"
        )
    }

    @objc func saveWeighInSnapshot(_ call: CAPPluginCall) {
        saveJSONSnapshot(
            call,
            key: weighInSnapshotKey,
            widgetKind: "BalanceWeighInWidget",
            errorLabel: "weigh-in"
        )
    }

    private func saveJSONSnapshot(_ call: CAPPluginCall, key: String, widgetKind: String, errorLabel: String) {
        guard let json = call.getString("json"), let data = json.data(using: .utf8) else {
            call.resolve(["success": false, "reason": "missing-json"])
            return
        }

        do {
            _ = try JSONSerialization.jsonObject(with: data, options: [])
            UserDefaults.standard.set(data, forKey: key)

            guard let sharedDefaults = UserDefaults(suiteName: appGroupID) else {
                call.resolve(["success": false, "reason": "app-group-unavailable"])
                return
            }

            sharedDefaults.set(data, forKey: key)
            sharedDefaults.synchronize()

            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
            }

            call.resolve(["success": true])
        } catch {
            call.reject("Could not save \(errorLabel) widget snapshot: \(error.localizedDescription)")
        }
    }

    private static func doubleValue(_ call: CAPPluginCall, _ key: String, defaultValue: Double) -> Double {
        Double(call.getFloat(key) ?? Float(defaultValue))
    }

    private static func todayString() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}
