plugins {
    alias(libs.plugins.kotlinJvm)
    alias(libs.plugins.ktor)
    application
    kotlin("plugin.serialization") version "2.2.10"
}

group = "org.dark.project"
version = "1.0.0"
application {
    mainClass.set("org.dark.project.ApplicationKt")

    val isDevelopment: Boolean = project.ext.has("development")
    applicationDefaultJvmArgs = listOf("-Dio.ktor.development=$isDevelopment")
}

dependencies {
    implementation("io.ktor:ktor-server-netty:3.0.0")
    implementation("io.ktor:ktor-server-core:3.0.0")
    implementation("io.ktor:ktor-server-cors:3.0.0")
    implementation("io.ktor:ktor-server-call-logging:3.0.0")
    implementation("io.ktor:ktor-server-content-negotiation:3.0.0")
    implementation("io.ktor:ktor-serialization-kotlinx-json:3.0.0")

    // JSON
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // HTTP client for OpenAI / LM Studio
    implementation("io.ktor:ktor-client-core:3.0.0")
    implementation("io.ktor:ktor-client-cio:3.0.0")
    implementation("io.ktor:ktor-client-content-negotiation:3.0.0")
    implementation("io.ktor:ktor-client-encoding:3.0.0")
    implementation("io.ktor:ktor-client-logging:3.0.0")
    implementation("io.ktor:ktor-serialization-kotlinx-json:3.0.0")
    implementation(projects.shared)
    implementation(libs.logback)
    implementation(libs.ktor.serverCore)
    implementation(libs.ktor.serverNetty)
    testImplementation(libs.ktor.serverTestHost)
    testImplementation(libs.kotlin.testJunit)
}
