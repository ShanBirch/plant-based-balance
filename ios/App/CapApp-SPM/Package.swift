// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.4.2"),
        .package(name: "CapacitorCommunityInAppReview", path: "../../../node_modules/@capacitor-community/in-app-review"),
        .package(name: "CapacitorLocalNotifications", path: "../../../node_modules/@capacitor/local-notifications"),
        .package(name: "CapacitorPushNotifications", path: "../../../node_modules/@capacitor/push-notifications"),
        .package(name: "CapgoBackgroundGeolocation", path: "../../../node_modules/@capgo/background-geolocation"),
        .package(name: "CapgoCapacitorHealth", path: "../../../node_modules/@capgo/capacitor-health")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunityInAppReview", package: "CapacitorCommunityInAppReview"),
                .product(name: "CapacitorLocalNotifications", package: "CapacitorLocalNotifications"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"),
                .product(name: "CapgoBackgroundGeolocation", package: "CapgoBackgroundGeolocation"),
                .product(name: "CapgoCapacitorHealth", package: "CapgoCapacitorHealth")
            ]
        )
    ]
)
