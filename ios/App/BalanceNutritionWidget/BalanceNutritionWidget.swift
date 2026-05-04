import WidgetKit
import SwiftUI

private let appGroupID = "group.com.fitgotchi.app"
private let snapshotKey = "nutritionWidgetSnapshot"

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

    static func todayString() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}

struct NutritionEntry: TimelineEntry {
    let date: Date
    let snapshot: NutritionSnapshot
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

struct BalanceNutritionWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: NutritionEntry

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
        VStack(alignment: .leading, spacing: 8) {
            header
            Spacer(minLength: 2)
            Text(remainingText)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundColor(.balanceGreen)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Text("\(entry.snapshot.caloriesInt) / \(entry.snapshot.calorieGoalInt) kcal")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.balanceSecondaryText)
            ProgressView(value: entry.snapshot.calorieProgress)
                .tint(.balanceGreen)
            Text("\(entry.snapshot.mealCount) meal\(entry.snapshot.mealCount == 1 ? "" : "s")")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.balanceSecondaryText)
        }
        .widgetURL(shortcutURL("quick-log"))
    }

    private var mediumView: some View {
        VStack(alignment: .leading, spacing: 9) {
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
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                        .foregroundColor(.balanceGreen)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                    Text("\(entry.snapshot.caloriesInt) / \(entry.snapshot.calorieGoalInt) kcal")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.balanceSecondaryText)
                }
                Spacer()
                Text("\(entry.snapshot.mealCount) meal\(entry.snapshot.mealCount == 1 ? "" : "s")")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(Color.balancePill)
                    .clipShape(Capsule())
            }

            ProgressView(value: entry.snapshot.calorieProgress)
                .tint(.balanceGreen)

            HStack(spacing: 8) {
                MacroText(label: "P", value: entry.snapshot.proteinInt, goal: entry.snapshot.proteinGoalInt, color: .blue)
                MacroText(label: "C", value: entry.snapshot.carbsInt, goal: entry.snapshot.carbsGoalInt, color: .orange)
                MacroText(label: "F", value: entry.snapshot.fatInt, goal: entry.snapshot.fatGoalInt, color: .red)
            }

            HStack(spacing: 6) {
                ActionLink(title: "Photo", systemImage: "camera", action: "quick-log-photo")
                ActionLink(title: "Scan", systemImage: "barcode.viewfinder", action: "barcode")
                ActionLink(title: "Type", systemImage: "square.and.pencil", action: "quick-log")
                ActionLink(title: "Manual", systemImage: "plus.rectangle.on.rectangle", action: "manual-log")
                ActionLink(title: "Build", systemImage: "fork.knife", action: "meal-builder")
                ActionLink(title: "Meals", systemImage: "clock", action: "recent-meals")
            }
        }
    }

    private var header: some View {
        EmptyView()
    }

    private var remainingText: String {
        let remaining = entry.snapshot.caloriesRemaining
        return "\(abs(remaining)) kcal \(remaining >= 0 ? "left" : "over")"
    }

    private var statusText: String {
        guard entry.snapshot.updatedAt > 0 else { return "Open Balance to sync" }
        guard entry.snapshot.isCurrentDay else { return "Open Balance to sync" }
        let date = Date(timeIntervalSince1970: entry.snapshot.updatedAt / 1000)
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return "Synced \(formatter.string(from: date))"
    }

    private func shortcutURL(_ action: String) -> URL {
        URL(string: "com.fitgotchi.app://shortcut/\(action)")!
    }
}

struct MacroText: View {
    let label: String
    let value: Int
    let goal: Int
    let color: Color

    var body: some View {
        Text("\(label) \(value)/\(goal)g")
            .font(.system(size: 12, weight: .bold))
            .foregroundColor(color)
            .frame(maxWidth: .infinity, alignment: label == "P" ? .leading : (label == "F" ? .trailing : .center))
            .lineLimit(1)
            .minimumScaleFactor(0.75)
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
    static let balanceSecondaryText = Color.white.opacity(0.72)
}

@main
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
