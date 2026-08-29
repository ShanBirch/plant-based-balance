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
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.1.0"),
        .package(name: "CapacitorFilesystem", path: "..\..\..\node_modules\.pnpm\@capacitor+filesystem@8.1.0_@capacitor+core@8.1.0\node_modules\@capacitor\filesystem"),
        .package(name: "CapacitorShare", path: "..\..\..\node_modules\.pnpm\@capacitor+share@8.0.1_@capacitor+core@8.1.0\node_modules\@capacitor\share"),
        .package(name: "RevenuecatPurchasesCapacitor", path: "..\..\..\node_modules\.pnpm\@revenuecat+purchases-capacitor@13.4.1_@capacitor+core@8.1.0\node_modules\@revenuecat\purchases-capacitor"),
        .package(name: "CapacitorPluginCdvPurchase", path: "..\..\..\node_modules\.pnpm\capacitor-plugin-cdv-purchase@13.18.0_@capacitor+core@8.1.0\node_modules\capacitor-plugin-cdv-purchase")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorFilesystem", package: "CapacitorFilesystem"),
                .product(name: "CapacitorShare", package: "CapacitorShare"),
                .product(name: "RevenuecatPurchasesCapacitor", package: "RevenuecatPurchasesCapacitor"),
                .product(name: "CapacitorPluginCdvPurchase", package: "CapacitorPluginCdvPurchase")
            ]
        )
    ]
)
