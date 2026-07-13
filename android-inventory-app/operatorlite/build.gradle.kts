plugins {
    id("com.android.application")
}

android {
    namespace = "com.molinobriganti.operatorlite"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.molinobriganti.operatorlite"
        minSdk = 17
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    applicationVariants.all {
        val variant = this
        variant.outputs.all {
            val output = this as com.android.build.gradle.internal.api.BaseVariantOutputImpl
            output.outputFileName = "OperatorLite-v${variant.versionName}-${variant.buildType.name}.apk"
        }
    }
}

dependencies {
}
