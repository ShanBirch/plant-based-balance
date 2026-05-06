import WidgetKit
import SwiftUI
import Foundation
import AppIntents

private let appGroupID = "group.com.fitgotchi.app"
private let snapshotKey = "nutritionWidgetSnapshot"
private let nutritionWidgetRangeKey = "nutritionWidgetRange"
private let dailyQuizSnapshotKey = "dailyQuizWidgetSnapshot"
private let weighInSnapshotKey = "weighInWidgetSnapshot"

@available(iOSApplicationExtension 17.0, *)
struct SetNutritionRangeIntent: AppIntent {
    static var title: LocalizedStringResource = "Set Nutrition Range"
    static var openAppWhenRun = false

    @Parameter(title: "Range")
    var range: String

    init() {
        self.range = "day"
    }

    init(range: String) {
        self.range = range
    }

    func perform() async throws -> some IntentResult {
        let selected = ["day", "week", "month"].contains(range) ? range : "day"
        if let defaults = UserDefaults(suiteName: appGroupID) {
            defaults.set(selected, forKey: nutritionWidgetRangeKey)
            defaults.synchronize()
        }
        WidgetCenter.shared.reloadTimelines(ofKind: "BalanceNutritionWidget")
        return .result()
    }
}

struct NutritionPeriodSnapshot: Codable {
    var key: String
    var shortLabel: String
    var title: String
    var dateLabel: String
    var calories: Double
    var calorieGoal: Double
    var protein: Double
    var proteinGoal: Double
    var carbs: Double
    var carbsGoal: Double
    var fat: Double
    var fatGoal: Double
    var mealCount: Int
    var daysLogged: Int
    var periodDays: Int
    var daysRemaining: Int
    var updatedAt: Double

    var caloriesInt: Int { Int(calories.rounded()) }
    var calorieGoalInt: Int { max(1, Int(calorieGoal.rounded())) }
    var proteinInt: Int { Int(protein.rounded()) }
    var proteinGoalInt: Int { max(1, Int(proteinGoal.rounded())) }
    var carbsInt: Int { Int(carbs.rounded()) }
    var carbsGoalInt: Int { max(1, Int(carbsGoal.rounded())) }
    var fatInt: Int { Int(fat.rounded()) }
    var fatGoalInt: Int { max(1, Int(fatGoal.rounded())) }
    var caloriesRemaining: Int { calorieGoalInt - caloriesInt }
    var calorieProgress: Double { min(max(calories / max(calorieGoal, 1), 0), 1) }
    var countText: String {
        if key == "day" { return "\(mealCount) meal\(mealCount == 1 ? "" : "s")" }
        return "\(daysLogged)/\(periodDays) days"
    }

    static func fromSnapshot(_ snapshot: NutritionSnapshot) -> NutritionPeriodSnapshot {
        NutritionPeriodSnapshot(
            key: "day",
            shortLabel: "Day",
            title: "Today",
            dateLabel: "Today",
            calories: snapshot.calories,
            calorieGoal: snapshot.calorieGoal,
            protein: snapshot.protein,
            proteinGoal: snapshot.proteinGoal,
            carbs: snapshot.carbs,
            carbsGoal: snapshot.carbsGoal,
            fat: snapshot.fat,
            fatGoal: snapshot.fatGoal,
            mealCount: snapshot.mealCount,
            daysLogged: snapshot.mealCount > 0 ? 1 : 0,
            periodDays: 1,
            daysRemaining: 0,
            updatedAt: snapshot.updatedAt
        )
    }
}

struct NutritionSnapshot: Codable {
    var date: String
    var calories: Double
    var calorieGoal: Double
    var protein: Double
    var proteinGoal: Double
    var carbs: Double
    var carbsGoal: Double
    var fat: Double
    var fatGoal: Double
    var mealCount: Int
    var selectedRange: String? = nil
    var rangesJson: String? = nil
    var updatedAt: Double

    static let empty = NutritionSnapshot(
        date: Self.todayString(),
        calories: 0,
        calorieGoal: 2000,
        protein: 0,
        proteinGoal: 50,
        carbs: 0,
        carbsGoal: 250,
        fat: 0,
        fatGoal: 70,
        mealCount: 0,
        updatedAt: 0
    )

    var caloriesInt: Int { Int(calories.rounded()) }
    var calorieGoalInt: Int { max(1, Int(calorieGoal.rounded())) }
    var proteinInt: Int { Int(protein.rounded()) }
    var proteinGoalInt: Int { max(1, Int(proteinGoal.rounded())) }
    var carbsInt: Int { Int(carbs.rounded()) }
    var carbsGoalInt: Int { max(1, Int(carbsGoal.rounded())) }
    var fatInt: Int { Int(fat.rounded()) }
    var fatGoalInt: Int { max(1, Int(fatGoal.rounded())) }
    var caloriesRemaining: Int { calorieGoalInt - caloriesInt }
    var calorieProgress: Double { min(max(calories / max(calorieGoal, 1), 0), 1) }
    var isCurrentDay: Bool { date == Self.todayString() }

    func period(for range: String) -> NutritionPeriodSnapshot {
        let normalized = ["day", "week", "month"].contains(range) ? range : "day"
        if let rangesJson = rangesJson,
           let data = rangesJson.data(using: .utf8),
           let ranges = try? JSONDecoder().decode([String: NutritionPeriodSnapshot].self, from: data) {
            return ranges[normalized] ?? ranges["day"] ?? .fromSnapshot(self)
        }
        return .fromSnapshot(self)
    }

    static func todayString() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}

struct DailyQuizQuestion: Codable, Identifiable {
    var id: String { question }
    var question: String
    var options: [String]
    var answerIndex: Int
}

struct DailyQuizSnapshot: Codable {
    var date: String
    var lessonId: String
    var lessonTitle: String
    var moduleTitle: String
    var unitTitle: String
    var questions: [DailyQuizQuestion]

    static let empty = DailyQuizSnapshot(
        date: NutritionSnapshot.todayString(),
        lessonId: "",
        lessonTitle: "Daily Quiz",
        moduleTitle: "Learning",
        unitTitle: "Health IQ",
        questions: []
    )

    var isCurrentDay: Bool { date == NutritionSnapshot.todayString() }
    var hasQuestions: Bool { isCurrentDay && !questions.isEmpty }
    var question: DailyQuizQuestion? { hasQuestions ? questions[0] : nil }
    var displayTitle: String { lessonTitle.isEmpty ? "Daily Quiz" : lessonTitle }
    var contextText: String {
        let parts = [moduleTitle, unitTitle].filter { !$0.isEmpty }
        return parts.isEmpty ? "Open Balance to sync" : parts.joined(separator: " - ")
    }
}

struct WeighInSnapshot: Codable {
    var date: String
    var loggedToday: Bool
    var latestWeightKg: Double
    var todayWeightKg: Double
    var updatedAt: Double

    static let empty = WeighInSnapshot(
        date: NutritionSnapshot.todayString(),
        loggedToday: false,
        latestWeightKg: 80,
        todayWeightKg: 80,
        updatedAt: 0
    )

    var isCurrentDay: Bool { date == NutritionSnapshot.todayString() }
    var displayWeight: String {
        String(format: "%.1f kg", isCurrentDay && loggedToday ? todayWeightKg : latestWeightKg)
    }
    var statusText: String {
        if isCurrentDay && loggedToday { return "Logged today" }
        if updatedAt > 0 { return "Last weigh-in ready" }
        return "Open Balance to sync"
    }
}

struct NutritionEntry: TimelineEntry {
    let date: Date
    let snapshot: NutritionSnapshot
}

struct DailyQuizEntry: TimelineEntry {
    let date: Date
    let snapshot: DailyQuizSnapshot
}

struct WeighInEntry: TimelineEntry {
    let date: Date
    let snapshot: WeighInSnapshot
}

struct NutritionProvider: TimelineProvider {
    func placeholder(in context: Context) -> NutritionEntry {
        NutritionEntry(date: Date(), snapshot: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (NutritionEntry) -> Void) {
        completion(NutritionEntry(date: Date(), snapshot: loadSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NutritionEntry>) -> Void) {
        let entry = NutritionEntry(date: Date(), snapshot: loadSnapshot())
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func loadSnapshot() -> NutritionSnapshot {
        guard let defaults = UserDefaults(suiteName: appGroupID),
              let data = defaults.data(forKey: snapshotKey),
              let snapshot = try? JSONDecoder().decode(NutritionSnapshot.self, from: data) else {
            return .empty
        }
        return snapshot
    }
}

struct DailyQuizProvider: TimelineProvider {
    func placeholder(in context: Context) -> DailyQuizEntry {
        DailyQuizEntry(date: Date(), snapshot: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (DailyQuizEntry) -> Void) {
        completion(DailyQuizEntry(date: Date(), snapshot: loadSharedSnapshot(DailyQuizSnapshot.self, key: dailyQuizSnapshotKey, fallback: .empty)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DailyQuizEntry>) -> Void) {
        let entry = DailyQuizEntry(date: Date(), snapshot: loadSharedSnapshot(DailyQuizSnapshot.self, key: dailyQuizSnapshotKey, fallback: .empty))
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct WeighInProvider: TimelineProvider {
    func placeholder(in context: Context) -> WeighInEntry {
        WeighInEntry(date: Date(), snapshot: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (WeighInEntry) -> Void) {
        completion(WeighInEntry(date: Date(), snapshot: loadSharedSnapshot(WeighInSnapshot.self, key: weighInSnapshotKey, fallback: .empty)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeighInEntry>) -> Void) {
        let entry = WeighInEntry(date: Date(), snapshot: loadSharedSnapshot(WeighInSnapshot.self, key: weighInSnapshotKey, fallback: .empty))
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

private func loadSharedSnapshot<T: Decodable>(_ type: T.Type, key: String, fallback: T) -> T {
    guard let defaults = UserDefaults(suiteName: appGroupID),
          let data = defaults.data(forKey: key),
          let snapshot = try? JSONDecoder().decode(type, from: data) else {
        return fallback
    }
    return snapshot
}

struct BalanceNutritionWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @AppStorage(nutritionWidgetRangeKey, store: UserDefaults(suiteName: appGroupID)) private var selectedRange = "day"
    let entry: NutritionEntry

    private var period: NutritionPeriodSnapshot {
        entry.snapshot.period(for: selectedRange)
    }

    var body: some View {
        Group {
            if family == .systemSmall {
                smallView
            } else {
                mediumView
            }
        }
        .widgetSurface()
    }

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 7) {
            header
            Spacer(minLength: 2)
            Text(remainingText)
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundColor(.balanceGreen)
                .lineLimit(1)
                .minimumScaleFactor(0.65)
            Text("\(formatted(period.caloriesInt)) / \(formatted(period.calorieGoalInt)) kcal")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.balanceSecondaryText)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            ProgressView(value: period.calorieProgress)
                .tint(.balanceGreen)
            rangePicker(compact: true)
            Text(period.countText)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.balanceSecondaryText)
                .lineLimit(1)
        }
        .widgetURL(shortcutURL("quick-log"))
    }

    private var mediumView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                header
                Spacer()
                Text(statusText)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.balanceSecondaryText)
            }

            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(remainingText)
                        .font(.system(size: 23, weight: .bold, design: .rounded))
                        .foregroundColor(.balanceGreen)
                        .lineLimit(1)
                        .minimumScaleFactor(0.65)
                    Text("\(formatted(period.caloriesInt)) / \(formatted(period.calorieGoalInt)) kcal")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.balanceSecondaryText)
                }
                Spacer()
                Text(period.countText)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(Color.balancePill)
                    .clipShape(Capsule())
            }

            ProgressView(value: period.calorieProgress)
                .tint(.balanceGreen)

            HStack(spacing: 8) {
                MacroText(label: "P", value: period.proteinInt, goal: period.proteinGoalInt, color: .blue)
                MacroText(label: "C", value: period.carbsInt, goal: period.carbsGoalInt, color: .orange)
                MacroText(label: "F", value: period.fatInt, goal: period.fatGoalInt, color: .red)
            }

            rangePicker(compact: false)

            HStack(spacing: 6) {
                ActionLink(title: "Photo", systemImage: "camera", action: "quick-log-photo")
                ActionLink(title: "Scan", systemImage: "barcode.viewfinder", action: "barcode")
                ActionLink(title: "Type", systemImage: "square.and.pencil", action: "quick-log")
                ActionLink(title: "Manual", systemImage: "plus.rectangle.on.rectangle", action: "manual-log")
                ActionLink(title: "Build", systemImage: "fork.knife", action: "meal-builder")
                ActionLink(title: "Recent", systemImage: "clock", action: "recent-meals")
            }
        }
    }

    private var header: some View {
        Text(period.title)
            .font(.system(size: 13, weight: .bold, design: .rounded))
            .foregroundColor(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.75)
    }

    private var remainingText: String {
        let remaining = period.caloriesRemaining
        return "\(formatted(abs(remaining))) kcal \(remaining >= 0 ? "left" : "over")"
    }

    private var statusText: String {
        guard period.updatedAt > 0 else { return "Open Balance to sync" }
        guard entry.snapshot.isCurrentDay else { return "Open Balance to sync" }
        let date = Date(timeIntervalSince1970: period.updatedAt / 1000)
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return "Synced \(formatter.string(from: date))"
    }

    @ViewBuilder
    private func rangePicker(compact: Bool) -> some View {
        HStack(spacing: 4) {
            NutritionRangeButton(title: "Day", range: "day", selectedRange: selectedRange, compact: compact)
            NutritionRangeButton(title: "Week", range: "week", selectedRange: selectedRange, compact: compact)
            NutritionRangeButton(title: "Month", range: "month", selectedRange: selectedRange, compact: compact)
        }
    }

    private func formatted(_ value: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    private func shortcutURL(_ action: String) -> URL {
        URL(string: "com.fitgotchi.app://shortcut/\(action)")!
    }
}

struct BalanceDailyQuizWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DailyQuizEntry

    var body: some View {
        Group {
            if family == .systemLarge {
                largeView
            } else if family == .systemMedium {
                mediumView
            } else {
                smallView
            }
        }
        .widgetSurface()
        .widgetURL(shortcutURL("daily-quiz"))
    }

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 8) {
            widgetHeader(title: "Daily Quiz", badge: entry.snapshot.hasQuestions ? "1/\(min(entry.snapshot.questions.count, 8))" : "Sync")
            Spacer(minLength: 2)
            Text(entry.snapshot.question?.question ?? "Open Balance to sync today's Learning quiz.")
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .lineLimit(5)
                .minimumScaleFactor(0.72)
            Text(entry.snapshot.displayTitle)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.balanceSecondaryText)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
    }

    private var mediumView: some View {
        VStack(alignment: .leading, spacing: 10) {
            widgetHeader(title: "Daily Quiz", badge: entry.snapshot.hasQuestions ? "Learning" : "Sync")
            Text(entry.snapshot.question?.question ?? "Open Balance to sync today's Learning quiz.")
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .lineLimit(3)
                .minimumScaleFactor(0.75)
            optionRows(limit: 2)
            Text(entry.snapshot.contextText)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(.balanceSecondaryText)
                .lineLimit(1)
        }
    }

    private var largeView: some View {
        VStack(alignment: .leading, spacing: 12) {
            widgetHeader(title: "Daily Quiz", badge: entry.snapshot.hasQuestions ? "1/\(min(entry.snapshot.questions.count, 8))" : "Sync")
            Text(entry.snapshot.displayTitle)
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(.balanceGreen)
                .lineLimit(1)
            Text(entry.snapshot.question?.question ?? "Open Balance to sync today's Learning quiz.")
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .lineLimit(6)
                .minimumScaleFactor(0.72)
            optionRows(limit: 4)
            Spacer(minLength: 0)
            Text(entry.snapshot.contextText)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.balanceSecondaryText)
                .lineLimit(1)
        }
    }

    private func optionRows(limit: Int) -> some View {
        VStack(spacing: 6) {
            ForEach(Array((entry.snapshot.question?.options ?? ["Open Balance"]).prefix(limit)), id: \.self) { option in
                Text(option)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 7)
                    .padding(.horizontal, 8)
                    .background(Color.balancePill)
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            }
        }
    }
}

struct BalanceWeighInWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: WeighInEntry

    var body: some View {
        Group {
            if family == .systemMedium {
                mediumView
            } else {
                smallView
            }
        }
        .widgetSurface()
        .widgetURL(shortcutURL("weigh-in"))
    }

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 8) {
            widgetHeader(title: "Weigh-In", badge: entry.snapshot.loggedToday ? "Done" : "Log")
            Spacer(minLength: 2)
            Text(entry.snapshot.displayWeight)
                .font(.system(size: 25, weight: .bold, design: .rounded))
                .foregroundColor(.balanceGreen)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(entry.snapshot.statusText)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.balanceSecondaryText)
                .lineLimit(2)
            Text("Tap to update")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.balancePill)
                .clipShape(Capsule())
        }
    }

    private var mediumView: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                widgetHeader(title: "Daily Weigh-In", badge: entry.snapshot.loggedToday ? "Logged" : "Ready")
                Text(entry.snapshot.displayWeight)
                    .font(.system(size: 29, weight: .bold, design: .rounded))
                    .foregroundColor(.balanceGreen)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text(entry.snapshot.statusText)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.balanceSecondaryText)
            }
            Spacer()
            Link(destination: shortcutURL("weigh-in")) {
                VStack(spacing: 5) {
                    Image(systemName: "scalemass")
                        .font(.system(size: 18, weight: .bold))
                    Text("Log")
                        .font(.system(size: 12, weight: .bold))
                }
                .foregroundColor(.white)
                .frame(width: 74, height: 58)
                .background(Color.balancePill)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
    }
}

struct BalanceMoodWidgetView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            if family == .systemMedium {
                mediumView
            } else {
                smallView
            }
        }
        .widgetSurface()
        .widgetURL(shortcutURL("mood-check"))
    }

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 8) {
            widgetHeader(title: "Mood Check", badge: "3 taps")
            Spacer(minLength: 2)
            Text("Mood, energy, stress")
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .lineLimit(3)
                .minimumScaleFactor(0.72)
            Text("Tap to check in")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.balanceSecondaryText)
        }
    }

    private var mediumView: some View {
        VStack(alignment: .leading, spacing: 12) {
            widgetHeader(title: "Mood Check", badge: "Balance")
            HStack(spacing: 8) {
                moodPill("Mood")
                moodPill("Energy")
                moodPill("Stress")
            }
            Text("Tap through the current check-in window.")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.balanceSecondaryText)
                .lineLimit(2)
        }
    }

    private func moodPill(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .bold))
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Color.balancePill)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private func widgetHeader(title: String, badge: String) -> some View {
    HStack(alignment: .center) {
        Text(title)
            .font(.system(size: 13, weight: .bold, design: .rounded))
            .foregroundColor(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.75)
        Spacer(minLength: 6)
        Text(badge)
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(.white)
            .lineLimit(1)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(Color.balancePillStrong)
            .clipShape(Capsule())
    }
}

private func shortcutURL(_ action: String) -> URL {
    URL(string: "com.fitgotchi.app://shortcut/\(action)")!
}

struct MacroText: View {
    let label: String
    let value: Int
    let goal: Int
    let color: Color

    var body: some View {
        Text("\(label) \(gramText(value))/\(gramText(goal))")
            .font(.system(size: 12, weight: .bold))
            .foregroundColor(color)
            .frame(maxWidth: .infinity, alignment: label == "P" ? .leading : (label == "F" ? .trailing : .center))
            .lineLimit(1)
            .minimumScaleFactor(0.65)
    }

    private func gramText(_ grams: Int) -> String {
        if grams >= 1000 {
            let kg = Double(grams) / 1000
            return kg >= 10 ? String(format: "%.0fkg", kg) : String(format: "%.1fkg", kg)
        }
        return "\(grams)g"
    }
}

struct NutritionRangeButton: View {
    let title: String
    let range: String
    let selectedRange: String
    let compact: Bool

    private var isActive: Bool { selectedRange == range }

    var body: some View {
        Group {
            if #available(iOSApplicationExtension 17.0, *) {
                Button(intent: SetNutritionRangeIntent(range: range)) {
                    label
                }
                .buttonStyle(.plain)
            } else {
                Link(destination: shortcutURL("calorie-tracker")) {
                    label
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var label: some View {
        Text(title)
            .font(.system(size: compact ? 9 : 10, weight: .bold))
            .foregroundColor(isActive ? .white : .balanceSecondaryText)
            .lineLimit(1)
            .minimumScaleFactor(0.75)
            .frame(maxWidth: .infinity)
            .padding(.vertical, compact ? 4 : 5)
            .background(isActive ? Color.balancePillStrong : Color.balancePill)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

struct ActionLink: View {
    let title: String
    let systemImage: String
    let action: String

    var body: some View {
        Link(destination: URL(string: "com.fitgotchi.app://shortcut/\(action)")!) {
            VStack(spacing: 3) {
                Image(systemName: systemImage)
                    .font(.system(size: 12, weight: .bold))
                Text(title)
                    .font(.system(size: 8, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .foregroundColor(.balanceGreenDark)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(Color.balancePill)
            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        }
    }
}

extension View {
    @ViewBuilder
    func widgetSurface() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(Color.black.opacity(0.72), for: .widget)
        } else {
            self.padding()
                .background(Color.black.opacity(0.72))
        }
    }
}

extension Color {
    static let balanceGreen = Color(red: 0.29, green: 0.87, blue: 0.50)
    static let balanceGreenDark = Color.white
    static let balancePill = Color.white.opacity(0.14)
    static let balancePillStrong = Color(red: 0.29, green: 0.87, blue: 0.50).opacity(0.22)
    static let balanceSecondaryText = Color.white.opacity(0.72)
}

struct BalanceNutritionWidget: Widget {
    let kind = "BalanceNutritionWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NutritionProvider()) { entry in
            BalanceNutritionWidgetView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("Track today's meals, then jump straight into logging.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct BalanceDailyQuizWidget: Widget {
    let kind = "BalanceDailyQuizWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DailyQuizProvider()) { entry in
            BalanceDailyQuizWidgetView(entry: entry)
        }
        .configurationDisplayName("Daily Quiz")
        .description("Show today's Learning quiz with a roomier layout.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct BalanceWeighInWidget: Widget {
    let kind = "BalanceWeighInWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeighInProvider()) { entry in
            BalanceWeighInWidgetView(entry: entry)
        }
        .configurationDisplayName("Daily Weigh-In")
        .description("Start from your latest weight and jump straight to logging.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct BalanceMoodWidget: Widget {
    let kind = "BalanceMoodWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StaticMoodProvider()) { _ in
            BalanceMoodWidgetView()
        }
        .configurationDisplayName("Mood Check")
        .description("Open the current mood, energy, and stress check-in.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct StaticMoodEntry: TimelineEntry {
    let date: Date
}

struct StaticMoodProvider: TimelineProvider {
    func placeholder(in context: Context) -> StaticMoodEntry {
        StaticMoodEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (StaticMoodEntry) -> Void) {
        completion(StaticMoodEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StaticMoodEntry>) -> Void) {
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [StaticMoodEntry(date: Date())], policy: .after(next)))
    }
}

@main
struct BalanceWidgetBundle: WidgetBundle {
    var body: some Widget {
        BalanceNutritionWidget()
        BalanceDailyQuizWidget()
        BalanceWeighInWidget()
        BalanceMoodWidget()
    }
}
