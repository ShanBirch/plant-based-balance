import AppIntents

@available(iOS 16.0, *)
struct OpenBalanceWorkoutIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Workout"
    static var description = IntentDescription("Open today's workout in Balance.")
    static var openAppWhenRun: Bool { true }

    func perform() async throws -> some IntentResult {
        BalanceShortcutHandoff.store("today-workout")
        return .result()
    }
}

@available(iOS 16.0, *)
struct OpenBalanceMealPlanIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Meal Plan"
    static var description = IntentDescription("Open your meal plan in Balance.")
    static var openAppWhenRun: Bool { true }

    func perform() async throws -> some IntentResult {
        BalanceShortcutHandoff.store("meal-plan")
        return .result()
    }
}

@available(iOS 16.0, *)
struct OpenBalanceQuickLogIntent: AppIntent {
    static var title: LocalizedStringResource = "Quick Log Food"
    static var description = IntentDescription("Open quick meal logging in Balance.")
    static var openAppWhenRun: Bool { true }

    func perform() async throws -> some IntentResult {
        BalanceShortcutHandoff.store("quick-log")
        return .result()
    }
}

@available(iOS 16.0, *)
struct OpenBalanceWorkoutBuilderIntent: AppIntent {
    static var title: LocalizedStringResource = "Build Workout"
    static var description = IntentDescription("Open the workout builder in Balance.")
    static var openAppWhenRun: Bool { true }

    func perform() async throws -> some IntentResult {
        BalanceShortcutHandoff.store("workout-builder")
        return .result()
    }
}

@available(iOS 16.0, *)
struct OpenBalanceCharacterIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Character"
    static var description = IntentDescription("Open your character in Balance.")
    static var openAppWhenRun: Bool { true }

    func perform() async throws -> some IntentResult {
        BalanceShortcutHandoff.store("fitgotchi")
        return .result()
    }
}

@available(iOS 16.0, *)
struct OpenBalanceMessagesIntent: AppIntent {
    static var title: LocalizedStringResource = "Message Shannon"
    static var description = IntentDescription("Open your message thread with Shannon in Balance.")
    static var openAppWhenRun: Bool { true }

    func perform() async throws -> some IntentResult {
        BalanceShortcutHandoff.store("coach")
        return .result()
    }
}

@available(iOS 16.0, *)
struct OpenBalanceFormCheckIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Form Check"
    static var description = IntentDescription("Open form check in Balance.")
    static var openAppWhenRun: Bool { true }

    func perform() async throws -> some IntentResult {
        BalanceShortcutHandoff.store("form-check")
        return .result()
    }
}

@available(iOS 16.0, *)
struct BalanceAppShortcuts: AppShortcutsProvider {
    @AppShortcutsBuilder
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenBalanceWorkoutIntent(),
            phrases: [
                "Open my workout in \(.applicationName)",
                "Start my workout in \(.applicationName)"
            ],
            shortTitle: "Workout",
            systemImageName: "figure.walk"
        )
        AppShortcut(
            intent: OpenBalanceWorkoutBuilderIntent(),
            phrases: [
                "Build a workout in \(.applicationName)",
                "Create a workout in \(.applicationName)"
            ],
            shortTitle: "Build Workout",
            systemImageName: "plus.circle"
        )
        AppShortcut(
            intent: OpenBalanceCharacterIntent(),
            phrases: [
                "Open my character in \(.applicationName)",
                "Show my character in \(.applicationName)"
            ],
            shortTitle: "Character",
            systemImageName: "person.crop.circle"
        )
        AppShortcut(
            intent: OpenBalanceMessagesIntent(),
            phrases: [
                "Message Shannon in \(.applicationName)",
                "Open messages in \(.applicationName)"
            ],
            shortTitle: "Messages",
            systemImageName: "message"
        )
        AppShortcut(
            intent: OpenBalanceFormCheckIntent(),
            phrases: [
                "Open form check in \(.applicationName)",
                "Check my form in \(.applicationName)"
            ],
            shortTitle: "Form Check",
            systemImageName: "camera.viewfinder"
        )
    }
}
